import fetch from 'node-fetch';
import { RemoteHost } from './types';

export class ServerSync {
  private idServer: string;
  private relayServer: string;

  constructor(idServer: string, relayServer: string) {
    this.idServer = idServer;
    this.relayServer = relayServer;
    console.log(`[ServerSync] Inicializado con ID Server: ${idServer}, Relay Server: ${relayServer}`);
  }

  async getOnlineHosts(): Promise<RemoteHost[]> {
    try {
      console.log(`[ServerSync] Intentando obtener hosts online desde ${this.idServer}`);
      
      // Intentar diferentes endpoints según la versión del servidor RustDesk
      const endpoints = [
        `http://${this.idServer}/api/online_clients`,
        `http://${this.idServer}/api/clients`,
        `http://${this.idServer}/clients`,
        `http://${this.idServer}/api/status`
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[ServerSync] Probando endpoint: ${endpoint}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos timeout
          
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MP-Reports/1.0'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            console.log(`[ServerSync] Endpoint exitoso: ${endpoint}`);
            const data = await response.json();
            
            // Manejar diferentes formatos de respuesta
            let clients = data.clients || data.data || data || [];
            
            if (Array.isArray(clients)) {
              const hosts = clients.map((client: any) => ({
                id: client.id || client.client_id || client.host_id || 'unknown',
                name: client.name || client.hostname || `Host ${client.id || client.client_id || 'unknown'}`,
                status: this.determineStatus(client),
                lastSeen: client.last_seen || client.last_online || client.timestamp || new Date().toISOString(),
                location: client.location || client.address || ''
              }));
              
              console.log(`[ServerSync] Encontrados ${hosts.length} hosts online`);
              return hosts;
            } else {
              console.log(`[ServerSync] Respuesta no es un array:`, typeof clients);
            }
          } else {
            console.warn(`[ServerSync] Endpoint ${endpoint} respondió con status: ${response.status}`);
          }
        } catch (endpointError: any) {
          console.warn(`[ServerSync] Endpoint ${endpoint} falló:`, endpointError?.message || endpointError);
          continue;
        }
      }

      // Si todos los endpoints fallan, retornar lista vacía
      console.warn(`[ServerSync] Todos los endpoints del servidor ${this.idServer} fallaron`);
      return [];
      
    } catch (error: any) {
      console.error('[ServerSync] Error obteniendo hosts online:', error?.message || error);
      return [];
    }
  }

  async registerHost(hostId: string, name: string): Promise<boolean> {
    try {
      console.log(`[ServerSync] Intentando registrar host ${hostId} (${name}) en ${this.idServer}`);
      
      const endpoints = [
        `http://${this.idServer}/api/register`,
        `http://${this.idServer}/api/hosts`,
        `http://${this.idServer}/register`
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[ServerSync] Probando endpoint de registro: ${endpoint}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MP-Reports/1.0'
            },
            body: JSON.stringify({
              id: hostId,
              name: name,
              timestamp: new Date().toISOString()
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            console.log(`[ServerSync] Host ${hostId} registrado exitosamente en ${endpoint}`);
            return true;
          } else {
            console.warn(`[ServerSync] Endpoint de registro ${endpoint} respondió con status: ${response.status}`);
          }
        } catch (endpointError: any) {
          console.warn(`[ServerSync] Endpoint de registro ${endpoint} falló:`, endpointError?.message || endpointError);
          continue;
        }
      }

      console.warn(`[ServerSync] Todos los endpoints de registro en ${this.idServer} fallaron`);
      return false;
      
    } catch (error: any) {
      console.error('[ServerSync] Error registrando host:', error?.message || error);
      return false;
    }
  }

  async pingServer(): Promise<boolean> {
    try {
      console.log(`[ServerSync] Haciendo ping al servidor ${this.idServer}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`http://${this.idServer}/ping`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const isOnline = response.ok;
      console.log(`[ServerSync] Ping al servidor ${this.idServer}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      return isOnline;
    } catch (error: any) {
      console.error(`[ServerSync] Error haciendo ping al servidor ${this.idServer}:`, error?.message || error);
      return false;
    }
  }

  async getServerInfo(): Promise<any> {
    try {
      console.log(`[ServerSync] Obteniendo información del servidor ${this.idServer}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`http://${this.idServer}/api/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const info = await response.json();
        console.log(`[ServerSync] Información del servidor obtenida:`, info);
        return info;
      } else {
        console.warn(`[ServerSync] No se pudo obtener información del servidor, status: ${response.status}`);
      }
      
      return null;
    } catch (error: any) {
      console.error('[ServerSync] Error obteniendo información del servidor:', error?.message || error);
      return null;
    }
  }

  private determineStatus(client: any): 'online' | 'offline' {
    // Lógica para determinar si un cliente está online
    if (client.online !== undefined) {
      return client.online ? 'online' : 'offline';
    }

    if (client.status) {
      return client.status === 'online' ? 'online' : 'offline';
    }

    // Verificar timestamp de última conexión
    if (client.last_seen || client.last_online) {
      const lastSeen = new Date(client.last_seen || client.last_online);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
      
      // Considerar offline si no se ha visto en más de 5 minutos
      return diffMinutes < 5 ? 'online' : 'offline';
    }

    // Por defecto, asumir offline
    return 'offline';
  }

  getServerUrl(): string {
    return this.idServer;
  }

  getRelayUrl(): string {
    return this.relayServer;
  }
}
