# Supabase Image Processor

Automatically generate thumbnails for images uploaded to Supabase Storage. This service:

1. Uses a PostgreSQL trigger to detect new image uploads
2. Processes images using Sharp to create thumbnails
3. Uploads thumbnails back to Supabase Storage
4. Runs efficiently in Coolify

## Setup

### 1. Database Setup

Run the SQL migration in `supabase/migrations/20250407_image_processing.sql` in your Supabase project. This will:
- Create the image processing queue table
- Set up the trigger for new image uploads

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in:
- SUPABASE_URL: Your Supabase project URL
- SUPABASE_SERVICE_KEY: Your service role key (with storage access)

### 3. Local Development

```bash
npm install
npm run dev
```

### 4. Deployment to Coolify

1. Create a new service in Coolify
2. Use the Dockerfile deployment method
3. Add the environment variables
4. Deploy!

## How it Works

1. When an image is uploaded to Supabase Storage, a trigger adds it to the processing queue
2. This service polls the queue every minute
3. For each unprocessed image:
   - Downloads the original
   - Creates a 200x200 thumbnail using Sharp
   - Uploads it to the 'thumbnails/' directory
   - Marks it as processed

## Thumbnail Access

Thumbnails are stored in the same bucket under the 'thumbnails/' prefix. For example:
- Original: `bucket/image.jpg`
- Thumbnail: `bucket/thumbnails/image.jpg`
