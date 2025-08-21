export type RemoteRole = 'host' | 'viewer';

export interface RemoteConfig {
  role: RemoteRole;
  idServer: string;
  relayServer: string;
  username?: string;
  password?: string;
  autoStart: boolean;
}

export interface RemoteHost {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  location?: string;
}

export interface RemoteConnection {
  hostId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  startTime?: string;
  endTime?: string;
}

export interface RustDeskProcess {
  pid: number;
  type: 'host' | 'viewer';
  startTime: string;
  config: RemoteConfig;
}
