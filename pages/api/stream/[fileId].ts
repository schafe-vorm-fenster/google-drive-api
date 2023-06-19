import type { NextApiRequest, NextApiResponse } from "next";
import {
  GoogleDriveDownloadFileResponse,
  downloadFile,
} from "../../../src/googleDriveClient/downloadFile";
import { CacheControlHeader } from "../../../src/config/CacheControlHeader";

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

  console.log(googleDriveFile);

  if (!googleDriveFile || !googleDriveFile?.binary) {
    return res.status(404).end(`Could not find a matching file (${id}).`);
  }

  return res
    .status(200)
    .setHeader("Content-type", googleDriveFile?.mimeType as string)
    .setHeader("Cache-Control", CacheControlHeader)
    .setHeader("Content-Length", parseInt(googleDriveFile?.size as string))
    .send(googleDriveFile?.binary as any);
  // return await googleDriveFile?.binary?.pipe(res);
}
