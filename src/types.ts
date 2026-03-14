export interface CMSSettings {
  apiUploadUrl: string;
  apiUnpublishUrl: string;
  apiAuthToken: string;
}

export type UploadAsset = {
  fileName: string;
  path: string;
  mimeType: string;
  buffer: ArrayBuffer;
};
