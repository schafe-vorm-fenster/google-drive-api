import Jimp from "jimp";
import { streamToBuffer } from "./streamToBuffer";
import { promisify } from "util";
import { Duplex, Stream } from "stream";

/**
 * Resizes an incoming image stream.
 * @param binary
 * @param mimeType
 * @returns Duplex
 */
export const resizeImage = async (
  binary: Stream,
  mimeType: string,
  width: number = 2000
): Promise<Duplex> => {
  if (!binary) throw new Error("No binary stream provided.");
  if (!mimeType) throw new Error("No mimeType provided.");

  const imagAsBuffer: Buffer = await streamToBuffer(binary);
  let newBinary: Duplex | void = undefined;
  newBinary = await Jimp.read(imagAsBuffer)
    .then((img) => {
      const r = img.resize(width, Jimp.AUTO);
      const b = promisify(r.getBuffer.bind(r));
      return b(mimeType as string);
    })
    .then((buff) => {
      const stream = new Duplex();
      stream.push(buff);
      stream.push(null);
      return stream;
    })
    .catch((err) => {
      throw new Error(err);
    });

  return newBinary as Duplex;
};
