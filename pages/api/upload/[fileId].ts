import Jimp from "jimp";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  GoogleDriveDownloadFileResponse,
  downloadFile,
} from "../../../src/googleDriveClient/downloadFile";
import { CacheControlHeader } from "../../../src/config/CacheControlHeader";
import { v2 as cloudinary } from "cloudinary";
import { Duplex, Stream } from "stream";
import { promisify } from "util";
const { Readable } = require("stream");

export interface CloudinaryUploadResponse {
  id: string;
  folder: string;
  public_id: string;
  url: string;
}

async function stream2buffer(stream: Stream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const _buf = Array<any>();

    stream.on("data", (chunk) => _buf.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(_buf)));
    stream.on("error", (err) => reject(`error converting stream - ${err}`));
  });
}

export async function uploadStream(buffer: any, fileId: string) {
  return new Promise((res, rej) => {
    const theTransformStream = cloudinary.uploader.upload_stream(
      { public_id: fileId, overwrite: true, folder: "googledrive" },
      (err, result) => {
        if (err) return rej(err);
        res(result);
      }
    );
    let str = Readable.from(buffer);
    str.pipe(theTransformStream);
  });
}

/**
 * @swagger
 * /api/upload/{fileId}:
 *   get:
 *     summary: Uploads a file from google drive to cloudinary. Mention that uploading to cloudinary is restricted to 10MB per file.
 *     description:
 *     tags:
 *       - Google Drive
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: fileId
 *         description: File id as string, e.g. "14yJm8-PYlzA-65hdL-MCjTKECHa9tLZS".
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Cloudinary file id.
 *       400:
 *         description: Missing file id parameter. Please provide a file id as url encoded string.
 *       404:
 *         description: Could not find or load a file.
 *       500:
 *         description: Could not upload file.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CloudinaryUploadResponse>
) {
  const { fileId } = req.query;

  if (!fileId)
    return res
      .status(400)
      .end(
        "Missing file id parameter. Please provide a file id as url encoded string."
      );

  const fileIdAsString: string = fileId as string;

  // split into extension and id
  const [id, ext] = fileIdAsString.split(".");
  let googleDriveFile: GoogleDriveDownloadFileResponse | undefined;
  try {
    googleDriveFile = await downloadFile({
      fileId: id as string,
    });
  } catch (error: Error | any) {
    console.log("catch error", error);
    return res
      .status(404)
      .end(error?.message || `Could not fetch file (${id}).`);
  }

  if (!googleDriveFile || !googleDriveFile?.binary) {
    return res.status(404).end(`Could not find a matching file (${id}).`);
  }

  // check size
  let newBinary: Duplex | void = undefined;
  if (parseInt(googleDriveFile?.size as string) >= 10485760) {
    if (googleDriveFile?.mimeType?.includes("image")) {
      console.log(
        "Image file is larger than 10MB, so resize it to max. 2000px width."
      );
      const imagAsBuffer = await stream2buffer(googleDriveFile.binary);
      newBinary = await Jimp.read(imagAsBuffer)
        .then((img) => {
          const r = img.resize(2000, Jimp.AUTO);
          const b = promisify(r.getBuffer.bind(r));
          return b(googleDriveFile?.mimeType as string);
        })
        .then((buff) => {
          const stream = new Duplex();
          stream.push(buff);
          stream.push(null);
          return stream;
        })
        .catch((err) => {
          // Handle an exception.
          console.error(err);
        });
    } else {
      return res.status(500).end(`File is too large. Max size is 10MB.`);
    }
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  let cloudinaryResponse: any = undefined;

  try {
    cloudinaryResponse = await uploadStream(
      newBinary || googleDriveFile.binary,
      googleDriveFile.id as string
    );
  } catch (error: Error | any) {
    console.log("catch error", error);
    return res
      .status(500)
      .end(error?.message || `Could not upload file (${id}).`);
  }

  return res
    .status(200)
    .setHeader("Content-type", googleDriveFile?.mimeType as string)
    .setHeader("Cache-Control", CacheControlHeader)
    .json({
      id: googleDriveFile?.id as string,
      folder: cloudinaryResponse?.folder as string,
      public_id: cloudinaryResponse?.public_id as string,
      url: cloudinaryResponse?.secure_url as string,
    });
}
