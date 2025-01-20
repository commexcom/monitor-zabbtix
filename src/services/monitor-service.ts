import { MikroTikClient } from "../clients/mikrotik-client";
import { ZabbixClient } from "../clients/zabbix-client";
import { ZabbixSenderClient } from "../clients/zabbix-sender-client";
import config from "../config";
import logger from "../utils/logger";

export class MonitorService {
  private zabbixClient: ZabbixClient;
  private zabbixSender: ZabbixSenderClient;

  constructor(zabbixClient: ZabbixClient, zabbixSender: ZabbixSenderClient) {
    this.zabbixClient = zabbixClient;
    this.zabbixSender = zabbixSender;
  }

  async checkAllLoadBalances(): Promise<void> {
    const healthCheckServer = config.healthCheckServer;
    try {
      console.log("Fetching Hosts from Zabbix...");
      const hosts = await this.zabbixClient.getHosts("20");
      console.log("Sucessfully fetched Hosts from Zabbix");

      const getMikrotikLoadbalances = hosts.map(async (host) => {
        try {
          const mikrotikClient = new MikroTikClient(
            host.interfaces[0].ip,
            config.mikrotikLanUser,
            config.mikrotikLanPassword
          );

          const link1 = await mikrotikClient.ping(healthCheckServer, "ether1");
          console.log(`Pinging from ${host.host} eth1 done: ${link1}`);
          const link2 = await mikrotikClient.ping(healthCheckServer, "ether2");
          console.log(`Pinging from ${host.host} eth2 done: ${link2}`);

          await this.zabbixSender.addData(
            host.host,
            "key.interface.uplink.1",
            link1 ? 1 : 0
          );

          await this.zabbixSender.addData(
            host.host,
            "key.interface.uplink.2",
            link2 ? 1 : 0
          );
        } catch (error) {
          logger.error(`Error on checking LoadBalances`, error);
        }
      });

      await Promise.allSettled(getMikrotikLoadbalances);

      console.log("Sending data to Zabbix...");

      await this.zabbixSender.sendAll();
      console.log("Data Successfuly to Zabbix...");
    } catch (error) {
      logger.error(`Error on checking LoadBalances`, error);
    }
  }
}
