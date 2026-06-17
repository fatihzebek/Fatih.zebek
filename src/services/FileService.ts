import { ImageCompressor } from '../utils/imageCompressor';

class FileService {
  async uploadImage(file: File, _path: string): Promise<string> {
    let fileToUpload = file;

    // Auto-compress image if it's an image file and larger than 200KB
    if (file.type.startsWith('image/') && file.size > 200 * 1024) {
      try {
        console.log(`[FileService] Compressing large image: ${file.name} (${Math.round(file.size / 1024)} KB)`);
        fileToUpload = await ImageCompressor.compressImage(file, 1600, 1600, 0.85);
        console.log(`[FileService] Compressed to: ${fileToUpload.name} (${Math.round(fileToUpload.size / 1024)} KB)`);
      } catch (err) {
        console.warn('Image compression failed, using original file:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (err) => {
        reject(err);
      };
      reader.readAsDataURL(fileToUpload);
    });
  }
}

export const fileService = new FileService();


