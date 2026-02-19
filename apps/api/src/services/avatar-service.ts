export function generateDiceBearUrl(seed: string): string {
  const encoded = encodeURIComponent(seed);
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encoded}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export async function generateAndUploadAvatar(
  seed: string,
  r2Bucket: R2Bucket,
  key: string,
): Promise<string> {
  const url = generateDiceBearUrl(seed);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch avatar: ${response.status}`);
  }

  const svgBuffer = await response.arrayBuffer();
  await r2Bucket.put(key, svgBuffer, {
    httpMetadata: { contentType: "image/svg+xml" },
  });

  return key;
}
