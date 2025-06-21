import { ClearMcnReq } from "./generated/management";

/** 创建一个符合接口定义的js对象 */
const myRequest: ClearMcnReq = {
  parentVcuid: "vcuid-12345",
  reason: "Testing reason",
  reasonImages: [],
  operator: "Rick",
};

export const logBinaryData = () => {
  /** 如果需要手动发送请求，可以自己进行序列化 */
  const binaryData = ClearMcnReq.toBinary(myRequest);
  /** binaryData现在是一个Uint8Array, 可以被fetch的body使用 */
  console.log(binaryData);
};


