import Jimp from "jimp";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  GoogleDriveDownloadFileResponse,
  downloadFile,
} from "../../../src/googleDriveClient/downloadFile";
import { CacheControlHeader } from "../../../src/config/CacheControlHeader";

import { Duplex, Stream } from "stream";
import { promisify } from "util";
import { uploadStream } from "../../../src/cloudinaryClient/uploadStream";
import { resizeImage } from "../../../src/imageTools/resizeImage";
const { Readable } = require("stream");

export interface CloudinaryUploadResponse {
  id: string;
  folder: string;
  public_id: string;
  url: string;
  mime: string;
}

/**
 * @swagger
 * /api/upload/{fileId}:
 *   get:
 *     summary: Uploads a file from google drive to cloudinary. Mention that uploading to cloudinary is restricted to 10MB per file. Large image files will be resizes to max. 2000px width.
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

  // check size for non-images
  if (
    parseInt(googleDriveFile?.size as string) >= 10485760 &&
    !googleDriveFile?.mimeType?.includes("image")
  )
    return res
      .status(500)
      .end(`File is too large. Max size for non-images is 10MB.`);

  // check size for images
  let newBinary: Duplex | void = undefined;
  if (
    parseInt(googleDriveFile?.size as string) >= 10485760 &&
    googleDriveFile?.mimeType?.includes("image")
  ) {
    console.debug(
      "Image file is larger than 10MB, so resize it to max. 2000px width."
    );
    // try to scale down y 10MB, so 2000px is a proper size
    newBinary = await resizeImage(
      googleDriveFile.binary,
      googleDriveFile?.mimeType as string,
      2000
    );
  }

  // upload to cloudinary
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
      mime: googleDriveFile?.mimeType as string,
      url: cloudinaryResponse?.secure_url as string,
    });
}
