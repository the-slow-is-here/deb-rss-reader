export interface Feed {
  id: string;
  title: string;
  url: string;
  addedAt: string;
  starred: boolean;
  emailNotifications: boolean;
  color?: string | null;
}
