import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { ManagementClient } from "./generated/management.client";
import { useCallback } from "react";

/** 实例化客户端 */
const transport = new GrpcWebFetchTransport({
  baseUrl: "后端grpc-web服务的真实地址",
});
const client = new ManagementClient(transport);

export function McnManager() {
  const checkConditions = useCallback(async () => {
    /** rpc：能够像调用本地函数一样调用远程api */
    const call = client.batchCheckIncomeStatusModificationWhitelistConditions({
      vcuids: ["xxx"],
    });

    const res = await call.response;
  }, []);
}
