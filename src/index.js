// server.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

app.post('/process-image', async (req, res) => {
  const { bucket_id, name } = req.body.record;

  console.log(`Processing: ${name}`);
  console.log(`📥 Bucket details: ${bucket_id} ${name}`);

  const { data, error } = await supabase.storage.from(bucket_id).download(name);
  if (error || !data) {
    console.error('Error downloading image:', error);
    return res.status(500).send('Download failed');
  }

  const imageBuffer = await data.arrayBuffer();
  const imageVersions = [
    { width: 100, quality: 80, suffix: 'thumbnail' },
    { width: 400, quality: 80, suffix: 'small' },
    { width: 800, quality: 85, suffix: 'medium' },
    { width: 1200, quality: 90, suffix: 'large' }
  ];

  const uploadResults = await Promise.all(
    imageVersions.map(async ({ width, quality, suffix }) => {
      const resizedImage = await sharp(imageBuffer)
        .resize(width, null, { fit: 'contain' })
        .jpeg({ quality })
        .toBuffer();

      const fileName = name.replace(/\.[^/.]+$/, ''); // Remove extension
      const thumbPath = `${fileName}-${suffix}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(thumbPath, resizedImage, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`Failed to upload ${suffix}:`, uploadError);
        return { success: false, suffix, error: uploadError };
      }

      console.log(`✅ Uploaded ${suffix}: ${thumbPath}`);
      return { success: true, suffix, path: thumbPath };
    })
  );

  const failedUploads = uploadResults.filter(result => !result.success);
  if (failedUploads.length > 0) {
    console.error('Some uploads failed:', failedUploads);
    return res.status(500).json({ 
      message: 'Some image versions failed to upload',
      failures: failedUploads 
    });
  }

  res.json({ 
    message: 'All image versions created successfully',
    versions: uploadResults.map(r => ({ suffix: r.suffix, path: r.path }))
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Worker listening on port ${PORT}`));
