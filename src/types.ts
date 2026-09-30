export type Style = { font: string; size: number; color: string; bold: boolean; italic: boolean; outline: number; outlineColor: string; shadow: number; background: string; backgroundOpacity: number; padding: number; align: string; x: number; y: number; spacing: number };
export type Media = { id: string; path: string; name: string; type: 'video'|'audio'|'image'; duration: number; width: number; height: number; hasAudio: boolean; url: string; originalUrl?: string; thumbnail?: string; waveform?: number[]; waveformStep?: number; missing?: boolean };
export type Clip = { id: string; mediaId?: string; trackId: string; name: string; start: number; in: number; duration: number; speed: number; x: number; y: number; scale: number; rotation: number; fit: 'contain'|'cover'; opacity: number; brightness: number; contrast: number; saturation: number; volume: number; muted: boolean; fadeIn: number; fadeOut: number; transition: 'none'|'black'|'dissolve'; transitionDuration: number; text?: string; style?: Style; linkId?: string };
export type Track = { id: string; name: string; kind: 'video'|'audio'|'text'; hidden: boolean; muted: boolean; locked: boolean };
export type Caption = { id: string; start: number; end: number; text: string; style?: Style };
export type Project = { version: 1; id: string; name: string; width: number; height: number; fps: number; media: Media[]; tracks: Track[]; clips: Clip[]; captions: Caption[]; captionStyle: Style; captionStale: boolean; background: string };
export type Job = { id: string; kind: string; progress: number; message: string; state: 'running'|'done'|'error'|'cancelled'; result?: any };
export type Status = { ffmpeg: boolean; ffprobe: boolean; whisper: boolean; models: string[]; fonts: { name: string; path: string; url: string }[]; presets: { name: string; style: Style }[]; recent: { name: string; path: string; updated: string }[]; memoryGB: number; cpu: string; cacheMB: number; recovery?: Project };
export type ExportOptions = { height: number; fps: number; quality: 'standard'|'high'; burnCaptions: boolean; normalize: boolean; start: number; end: number };
export type API = {
  status(): Promise<Status>; importMedia(paths?: string[]): Promise<Media[]>; pathForFile(file: File): string;
  openProject(path?: string): Promise<{ project: Project; path: string }|null>;
  saveProject(project: Project, path?: string, portable?: boolean): Promise<string|null>;
  autosave(project: Project): Promise<void>; clearRecovery(): Promise<void>;
  exportVideo(project: Project, options: ExportOptions): Promise<string|null>;
  renderPreview(project: Project, start: number, end: number): Promise<string>;
  transcribe(project: Project, model: string, trackIds: string[], start: number, end: number): Promise<string>;
  installWhisper(): Promise<string>; downloadModel(model: string): Promise<string>;
  cancelJob(id: string): Promise<void>; onJob(fn: (job: Job)=>void): ()=>void;
  importCaptions(): Promise<Caption[]|null>; exportCaptions(project: Project, format: 'srt'|'ass'): Promise<string|null>;
  addFont(): Promise<{ name: string; path: string; url: string }|null>;
  savePreset(name: string, style: Style): Promise<void>;
  relink(project: Project, id: string): Promise<Media|null>;
  reveal(path: string): Promise<void>; clearCache(): Promise<void>;
};
declare global { interface Window { corte?: API } }
