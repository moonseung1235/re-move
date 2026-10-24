export type Tab = 'home' | 'records' | 'community' | 'more';
export type BodyArea = 'knee' | 'shoulder' | 'elbow' | 'other';
export type SymptomProfile = {
  description: string;
  areas: BodyArea[];
  side: 'left' | 'right' | 'both' | 'unsure';
  professionalGuidance: boolean;
  updatedAt: string;
};
export type Preferences = { saveOriginal: boolean };
export type Side = 'left' | 'right';
export type Goal = {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'achieved';
  primary: boolean;
  createdAt: string;
};
export type Exercise = {
  id: string;
  name: string;
  subtitle: string;
  bodyPart: string;
  duration: string;
  instructions: string[];
  cameraDirection: string;
  precautions: string;
  referenceUrl: string;
  joints: Record<Side, [number, number, number]>;
  jointName: string;
  repThresholds?: [number, number];
  color: string;
};
export type Plan = {
  id: string;
  exerciseId: string;
  sets: number;
  repetitions: number;
  frequency: string;
  notes: string;
  source: 'reference' | 'personal';
  confirmed: boolean;
};
export type Landmark = { x: number; y: number; z: number; visibility: number; presence?: number };
/** MediaPipe indices are preserved; excluded face slots 0–10 contain null. */
export type PoseLandmarks = (Landmark | null)[];
export type Frame = { time: number; angle: number | null; landmarks: PoseLandmarks };
export type Analysis = {
  min: number;
  max: number;
  range: number;
  validRatio: number;
  validFrames: number;
  totalFrames: number;
  repetitions: number | null;
  frames: Frame[];
};
export type Session = {
  id: string;
  exerciseId: string;
  recordedAt: string;
  duration: number;
  side: Side;
  cameraDirection: string;
  version: string;
  analysis: Analysis;
  mediaId?: string;
};
export type CaptureRecord = {
  id: string;
  exerciseId: string;
  recordedAt: string;
  duration: number;
  side: Side;
  cameraDirection: string;
  mediaId?: string;
  status: 'pending' | 'ready' | 'failed';
  error?: string;
  frames?: Frame[];
};
export type SharedRecord = {
  exerciseName?: string;
  date?: string;
  range?: number;
  difference?: number;
};
export type Comment = {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: string;
};
export type Post = {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: string;
  shared: SharedRecord;
  mediaId?: string;
  mediaType?: string;
  likes: string[];
  comments: Comment[];
};
export type AppData = {
  captures: CaptureRecord[];
  symptoms: SymptomProfile | null;
  preferences: Preferences;
  goals: Goal[];
  plans: Plan[];
  sessions: Session[];
  posts: Post[];
  nickname: string;
};
