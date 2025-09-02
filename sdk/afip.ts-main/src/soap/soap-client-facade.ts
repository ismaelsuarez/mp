import { resolve } from "path";
import { Client, createClientAsync } from "soap";
import type { Agent as HttpsAgent } from "https";
import { SoapClientParams } from "../types";

export class SoapClientFacade {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private construct() {}

  /**
   * Geth the path for the WSDL file stored on the WSDL folder.
   *
   * @param wsdlFile
   * @param forceFolderPath
   * @returns Path of wsdl file
   */
  private static getWsdlPath(
    wsdlFile: string,
    forceFolderPath?: string
  ): string {
    return resolve(forceFolderPath ?? resolve(__dirname, "wsdl/"), wsdlFile);
  }

  public static async create<T extends Client>({
    wsdl,
    options,
  }: SoapClientParams & { httpsAgent?: HttpsAgent }): Promise<T> {
    const opts: any = options ?? {};
    const httpsAgent: HttpsAgent | undefined = opts.httpsAgent;
    // Asegurar que la descarga del WSDL también use el agent
    if (httpsAgent) {
      opts.wsdl_options = { ...(opts.wsdl_options || {}), agent: httpsAgent };
    }

    const client = (await createClientAsync(
      SoapClientFacade.getWsdlPath(wsdl),
      opts
    )) as T;

    // Propagar agente HTTPS personalizado a las requests SOAP
    if (httpsAgent && (client as any)) {
      try {
        const httpLib = require('soap/lib/http.js');
        const BaseHttpClient = httpLib.HttpClient || httpLib;
        class AgentHttpClient extends BaseHttpClient {
          request(rurl: any, data: any, callback: any, exheaders: any, exoptions: any) {
            exoptions = exoptions || {};
            exoptions.agent = httpsAgent;
            return super.request(rurl, data, callback, exheaders, exoptions);
          }
        }
        (client as any).httpClient = new AgentHttpClient();
      } catch {
        // Si no podemos reemplazar el httpClient, al menos dejamos wsdl_options con agent
      }
    }
    return client;
  }
}
