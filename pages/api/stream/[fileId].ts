import type { NextApiRequest, NextApiResponse } from "next";
import {
  GoogleDriveDownloadFileResponse,
  downloadFile,
} from "../../../src/googleDriveClient/downloadFile";
import { CacheControlHeader } from "../../../src/config/CacheControlHeader";
import { Duplex } from "stream";
import { resizeImage } from "../../../src/imageTools/resizeImage";

/**
 * @swagger
 * /api/stream/{fileId}:
 *   get:
 *     summary: Streams trough a file from google drive. Mention that streaming is restricted to 4MB per file.
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
 *         description: File.
 *       400:
 *         description: Missing file id parameter. Please provide a file id as url encoded string.
 *       404:
 *         description: Could not find or load a file.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
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
      "Image file is larger than 4MB, so resize it to max. 1500px width."
    );
    // try to scale down y 4MB, so 1500px is a proper size
    newBinary = await resizeImage(
      googleDriveFile.binary,
      googleDriveFile?.mimeType as string,
      1500
    );
  }

  if (newBinary) {
    return res
      .status(200)
      .setHeader("Content-Type", googleDriveFile?.mimeType as string)
      .setHeader("Cache-Control", CacheControlHeader)
      .send(newBinary as Duplex);
  } else {
    return res
      .status(200)
      .setHeader("Content-Type", googleDriveFile?.mimeType as string)
      .setHeader("Cache-Control", CacheControlHeader)
      .setHeader("Content-Length", parseInt(googleDriveFile?.size as string))
      .send(googleDriveFile?.binary as any);
  }
}
