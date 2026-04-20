import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { DestinationInfo, DestinationAttractions, DestinationCheckins } from './destinations';

/** 获取 Supabase 客户端（服务端权限） */
function getClient() {
  return getSupabaseClient();
}

/** 目的地关键词缓存 */
export async function getCachedInfo(id: string): Promise<DestinationInfo | null> {
  const client = getClient();
  const { data, error } = await client
    .from('cache_info')
    .select('info, destination_name')
    .eq('destination_slug', id)
    .maybeSingle();

  if (error || !data) return null;
  return { id, name: data.destination_name, ...data.info } as DestinationInfo;
}

export async function setCachedInfo(item: DestinationInfo, name?: string): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('cache_info')
    .upsert(
      {
        destination_slug: item.id,
        destination_name: name ?? item.id,
        info: { keywords: item.keywords, summary: item.summary, reviews: item.reviews },
      },
      { onConflict: 'destination_slug' }
    );

  if (error) throw new Error(`缓存 info 写入失败: ${error.message}`);
}

/** 景点缓存 */
export async function getCachedAttractions(id: string): Promise<DestinationAttractions | null> {
  const client = getClient();
  const { data, error } = await client
    .from('cache_attractions')
    .select('attractions')
    .eq('destination_slug', id)
    .maybeSingle();

  if (error || !data) return null;
  return { id, attractions: data.attractions } as DestinationAttractions;
}

export async function setCachedAttractions(item: DestinationAttractions): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('cache_attractions')
    .upsert(
      {
        destination_slug: item.id,
        attractions: item.attractions,
      },
      { onConflict: 'destination_slug' }
    );

  if (error) throw new Error(`缓存 attractions 写入失败: ${error.message}`);
}

/** 打卡地缓存 */
export async function getCachedCheckins(id: string): Promise<DestinationCheckins | null> {
  const client = getClient();
  const { data, error } = await client
    .from('cache_checkins')
    .select('checkins')
    .eq('destination_slug', id)
    .maybeSingle();

  if (error || !data) return null;
  return { id, checkins: data.checkins } as DestinationCheckins;
}

export async function setCachedCheckins(item: DestinationCheckins): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('cache_checkins')
    .upsert(
      {
        destination_slug: item.id,
        checkins: item.checkins,
      },
      { onConflict: 'destination_slug' }
    );

  if (error) throw new Error(`缓存 checkins 写入失败: ${error.message}`);
}
