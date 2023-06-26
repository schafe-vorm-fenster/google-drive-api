import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

export async function uploadStream(buffer: any, fileId: string) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

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
