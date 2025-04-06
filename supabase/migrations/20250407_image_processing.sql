-- Create the queue table
create table if not exists public.image_processing_queue (
  id uuid default gen_random_uuid() primary key,
  object_path text not null,
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- Create the trigger function
create or replace function public.handle_storage_insert()
returns trigger as $$
begin
  -- Only queue image files
  if new.mime_type like 'image/%' then
    insert into public.image_processing_queue (object_path)
    values (new.name);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists on_storage_insert on storage.objects;
create trigger on_storage_insert
  after insert on storage.objects
  for each row execute procedure public.handle_storage_insert();
