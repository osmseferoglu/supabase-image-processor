// server.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/process-image', async (req, res) => {
  const { bucket_id, name } = req.body.record;

  console.log(`Processing: ${name}`);
  console.log(`📥 Bucket details: ${bucket_id} ${name}`);

  const { data, error } = await supabase.storage.from(bucket_id).download(name);
  if (error || !data) {
    console.error('Error downloading image:', error);
    return res.status(500).send('Download failed');
  }

  const resizedImage = await sharp(await data.arrayBuffer())
    .resize(200)
    .toBuffer();

  const thumbPath = `thumbnails/${name}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket_id)
    .upload(thumbPath, resizedImage, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (uploadError) {
    console.error('Thumbnail upload failed:', uploadError);
    return res.status(500).send('Upload failed');
  }

  console.log(`✅ Thumbnail uploaded: ${thumbPath}`);
  res.send('Thumbnail created');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Worker listening on port ${PORT}`));
