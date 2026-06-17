/**
 * High-Performance Client-Side Image Compressor for DH Servis
 * Optimizes image files by downscaling and compressing them to JPEG format,
 * ensuring high detail retention for technical tags and fine component defects
 * while drastically reducing file sizes for cellular upload performance.
 */
export class ImageCompressor {
  /**
   * Compresses an image file client-side using Canvas.
   * @param file The original File object uploaded by the user.
   * @param maxW The maximum width of the output image. Default is 1600px.
   * @param maxH The maximum height of the output image. Default is 1600px.
   * @param quality JPEG compression quality (0.0 to 1.0). Default is 0.85 (visually lossless).
   */
  static compressImage(
    file: File,
    maxW: number = 1600,
    maxH: number = 1600,
    quality: number = 0.85
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      // If it's not an image, resolve immediately with the original file
      if (!file.type.startsWith('image/')) {
        return resolve(file);
      }

      const reader = new FileReader();
      const timeoutId = setTimeout(() => reject(new Error('Resim işleme zaman aşımına uğradı. Desteklenmeyen format (Örn: HEIC) olabilir.')), 10000);

      reader.onerror = () => { clearTimeout(timeoutId); reject(new Error('Dosya okunamadı.')); };
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => { clearTimeout(timeoutId); reject(new Error('Geçersiz veya desteklenmeyen resim dosyası (Örn: iPhone HEIC).')); };
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Keep aspect ratio and scale to fit max boundaries
          if (width > height) {
            if (width > maxW) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            }
          } else {
            if (height > maxH) {
              width = Math.round((width * maxH) / height);
              height = maxH;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas context alınamadı.'));
          }

          // Use high quality image interpolation
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                clearTimeout(timeoutId);
                return reject(new Error('Görsel sıkıştırılamadı.'));
              }

              // Create a new File from the blob, replacing extension with jpeg if necessary
              let newName = file.name;
              if (!newName.toLowerCase().endsWith('.jpg') && !newName.toLowerCase().endsWith('.jpeg')) {
                const lastDot = newName.lastIndexOf('.');
                if (lastDot !== -1) {
                  newName = newName.substring(0, lastDot) + '.jpg';
                } else {
                  newName = newName + '.jpg';
                }
              }

              const compressedFile = new File([blob], newName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });

              clearTimeout(timeoutId);
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };

        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  }
}
