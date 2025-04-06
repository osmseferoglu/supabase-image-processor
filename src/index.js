import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const THUMBNAIL_SIZE = 200;
const BATCH_SIZE = 10;
const IMAGE_QUALITIES = {
  high: 90,
  medium: 70,
  low: 40,
  thumbnail: 80
};

async function downloadImage(path) {
  const { data, error } = await supabase.storage
    .from('objects')
    .download(path);
  
  if (error) throw error;
  return data;
}

async function uploadProcessedImage(buffer, originalPath, quality) {
  const qualityPath = `${quality}/${originalPath}`;
  const { error } = await supabase.storage
    .from('objects')
    .upload(qualityPath, buffer, {
      contentType: 'image/webp',
      upsert: true
    });
  
  if (error) throw error;
  return qualityPath;
}

async function markAsProcessed(id) {
  const { error } = await supabase
    .from('image_processing_queue')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
}

async function processImage(queueItem) {
  try {
    const imageBuffer = await downloadImage(queueItem.object_path);
    const image = sharp(imageBuffer);
    
    // Process different quality versions
    const [highQuality, mediumQuality, lowQuality] = await Promise.all([
      image.clone().webp({ quality: IMAGE_QUALITIES.high }).toBuffer(),
      image.clone().webp({ quality: IMAGE_QUALITIES.medium }).toBuffer(),
      image.clone().webp({ quality: IMAGE_QUALITIES.low }).toBuffer()
    ]);

    // Process thumbnail
    const thumbnailBuffer = await image.clone()
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: IMAGE_QUALITIES.thumbnail })
      .toBuffer();

    // Upload all versions
    await Promise.all([
      uploadProcessedImage(highQuality, queueItem.object_path, 'high'),
      uploadProcessedImage(mediumQuality, queueItem.object_path, 'medium'),
      uploadProcessedImage(lowQuality, queueItem.object_path, 'low'),
      uploadProcessedImage(thumbnailBuffer, queueItem.object_path, 'thumbnail')
    ]);

    await markAsProcessed(queueItem.id);
    console.log(`✅ Processed all qualities for: ${queueItem.object_path}`);
  } catch (error) {
    console.error(`❌ Error processing ${queueItem.object_path}:`, error);
  }
}

async function processUnprocessedImages() {
  const { data: queueItems, error } = await supabase
    .from('image_processing_queue')
    .select('*')
    .is('processed_at', null)
    .limit(BATCH_SIZE);
  
  if (error) {
    console.error('Error fetching queue:', error);
    return;
  }
  
  if (queueItems.length === 0) {
    console.log('No images to process');
    return;
  }
  
  console.log(`Processing ${queueItems.length} images...`);
  await Promise.all(queueItems.map(processImage));
}

// Run every minute
cron.schedule('* * * * *', processUnprocessedImages);

console.log('🖼️ Image processing service started');
