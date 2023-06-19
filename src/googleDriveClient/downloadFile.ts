import { GaxiosResponse } from "gaxios";
import { drive_v3, google } from "googleapis";
import { Readable, Stream } from "stream";
import Drive = drive_v3.Drive;
const fs = require("fs");
const { JWT } = require("google-auth-library");

type DriveFileMetadata = drive_v3.Schema$File;

type GoogleDriveFileMinimalMetadata = Pick<
  DriveFileMetadata,
  "id" | "name" | "mimeType" | "size"
>;

interface GoogleDriveFile extends GoogleDriveFileMinimalMetadata {
  binary?: Readable;
}

export type GoogleDriveDownloadFileQuery = {
  fileId: string;
};

export type GoogleDriveDownloadFileResponse = GoogleDriveFile | null;

export const downloadFile = async (
  query: GoogleDriveDownloadFileQuery
): Promise<GoogleDriveDownloadFileResponse> => {
  console.debug(
    `Execute googledrive.downloadfile(${query.fileId.substring(0, 20)}...)`
  );

  // init google api incl. auth by JWT for a server-to-server usage
  const auth = new google.auth.JWT(
    process.env.GOOGLEAPI_CLIENT_EMAIL,
    undefined,
    JSON.parse(`"${process.env.GOOGLEAPI_PRIVATE_KEY}"`),
    [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ]
  );
  const drive: Drive = google.drive({ version: "v3", auth });

  // get metadata
  const fileMetadata: GaxiosResponse = await drive.files.get({
    fileId: query.fileId,
    fields: "id, name, mimeType, size",
    alt: "json",
    supportsAllDrives: true,
  });

  const meta: DriveFileMetadata = fileMetadata.data;
  const localFile: GoogleDriveFile = {
    name: meta.name as string,
    id: meta.id as string,
    mimeType: meta.mimeType as string,
    size: meta.size,
  };

  if (!localFile?.id) throw new Error(`Could not fetch meta data.`);

  // check mime type
  if (localFile.mimeType == "application/vnd.google-apps.folder")
    throw new Error(`Given id represents a folder not a file.`);

  // get file itself
  const fileBinaryResponse: GaxiosResponse = await drive.files.get(
    {
      fileId: query.fileId,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "stream" }
  );

  const fileBinary: Readable = fileBinaryResponse.data as Readable;

  if (!fileBinary) throw new Error(`Could not fetch any binary.`);

  localFile.binary = fileBinary;

  if (localFile) {
    return localFile;
  } else {
    throw new Error(`No file found.`);
  }
};
