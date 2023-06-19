import type { NextApiRequest, NextApiResponse } from "next";
import {
  GoogleDriveDownloadFileResponse,
  downloadFile,
} from "../../../src/googleDriveClient/downloadFile";
import { CacheControlHeader } from "../../../src/config/CacheControlHeader";
import { v2 as cloudinary } from "cloudinary";

export interface CloudinaryUploadResponse {
  id: string;
  folder: string;
  public_id: string;
  url: string;
}

const { Readable } = require("stream");

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
 *     summary: Uploads a file from google drive to cloudinary.
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

  console.log(googleDriveFile);

  if (!googleDriveFile || !googleDriveFile?.binary) {
    return res.status(404).end(`Could not find a matching file (${id}).`);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const cloudinaryResponse: any = await uploadStream(
    googleDriveFile.binary,
    googleDriveFile.id as string
  );

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
