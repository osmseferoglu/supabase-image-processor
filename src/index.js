// worker.js
// Replace require with import
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function processQueue() {
  const { data: job } = await supabase
    .from('image_processing_queue')
    .select('*')
    .eq('processed', false)
    .limit(1)
    .single();

  if (!job) return;

  console.log(`Processing: ${job.name}`);

  const { data: file } = await supabase.storage
    .from(job.bucket_id)
    .download(job.name);

  const inputBuffer = await file.arrayBuffer();
  const outputBuffer = await sharp(Buffer.from(inputBuffer))
    .resize(300)
    .jpeg()
    .toBuffer();

  const thumbPath = `thumbnails/${job.name}`;

  const { error: uploadError } = await supabase.storage
    .from(job.bucket_id)
    .upload(thumbPath, outputBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload failed:", uploadError.message);
    return;
  }

  await supabase
    .from('image_processing_queue')
    .update({ processed: true })
    .eq('id', job.id);

  console.log(`✅ Thumbnail created for ${job.name}`);
}

setInterval(processQueue, 5000);
