import { promises as fs } from 'fs';
import path from 'path';

export async function processAndSaveImage(base64Str: string): Promise<string> {
  if (!base64Str || !base64Str.startsWith('data:image/')) {
    return base64Str; // Return as-is if it's already a URL or empty
  }

  const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return base64Str; // Cannot parse, return original
  }

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const filename = `product-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  
  // Ensure the directory exists
  await fs.mkdir(uploadDir, { recursive: true });
  
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);
  
  return `/uploads/${filename}`;
}
