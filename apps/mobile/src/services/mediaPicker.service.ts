import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export type MediaAttachment = { id: string; name: string; type: 'image' | 'video' | 'file'; uri: string };

export async function selectMediaAttachment(): Promise<MediaAttachment[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return result.assets.map((item, index) => ({
    id: `${Date.now()}-${index}`,
    name:
      item.fileName ??
      (item.type === 'video' ? 'Campaign-video.mp4' : 'Campaign-image.jpg'),
    type: item.type === 'video' ? 'video' : 'image',
    uri: item.uri,
  }));
}

export async function selectFileAttachment(): Promise<MediaAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const item = result.assets[0];
  return { id: `${Date.now()}`, name: item.name, type: 'file', uri: item.uri };
}
