import fetch from 'node-fetch';
import { RemoteHost } from './types';

export class ServerSync {
  private idServer: string;
  private relayServer: string;

  constructor(idServer: string, relayServer: string) {
    this.idServer = idServer;
    this.relayServer = relayServer;
  }

  async getOnlineHosts(): Promise<RemoteHost[]> {
    try {
      // Intentar diferentes endpoints según la versión del servidor RustDesk
      const endpoints = [
        `http://${this.idServer}/api/online_clients`,
        `http://${this.idServer}/api/clients`,
        `http://${this.idServer}/clients`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MP-Reports/1.0'
            },
            timeout: 10000 // 10 segundos timeout
          });

          if (response.ok) {
            const data = await response.json();
            
            // Manejar diferentes formatos de respuesta
            let clients = data.clients || data.data || data || [];
            
            return clients.map((client: any) => ({
              id: client.id || client.client_id || client.host_id,
              name: client.name || client.hostname || `Host ${client.id || client.client_id}`,
              status: this.determineStatus(client),
              lastSeen: client.last_seen || client.last_online || client.timestamp || new Date().toISOString(),
              location: client.location || client.address || ''
            }));
          }
        } catch (endpointError) {
          console.warn(`Endpoint ${endpoint} falló:`, endpointError);
          continue;
        }
      }

      // Si todos los endpoints fallan, retornar lista vacía
      console.warn('Todos los endpoints del servidor fallaron');
      return [];
      
    } catch (error) {
      console.error('Error obteniendo hosts online:', error);
      return [];
    }
  }

  async registerHost(hostId: string, name: string): Promise<boolean> {
    try {
      const endpoints = [
        `http://${this.idServer}/api/register`,
        `http://${this.idServer}/api/hosts`,
        `http://${this.idServer}/register`
      ];

      for (const endpoint of endpoints) {
        try {
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
            timeout: 10000
          });

          if (response.ok) {
            console.log(`Host ${hostId} registrado exitosamente en ${endpoint}`);
            return true;
          }
        } catch (endpointError) {
          console.warn(`Endpoint de registro ${endpoint} falló:`, endpointError);
          continue;
        }
      }

      console.warn('Todos los endpoints de registro fallaron');
      return false;
      
    } catch (error) {
      console.error('Error registrando host:', error);
      return false;
    }
  }

  async pingServer(): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.idServer}/ping`, {
        method: 'GET',
        timeout: 5000
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error haciendo ping al servidor:', error);
      return false;
    }
  }

  async getServerInfo(): Promise<any> {
    try {
      const response = await fetch(`http://${this.idServer}/api/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo información del servidor:', error);
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
