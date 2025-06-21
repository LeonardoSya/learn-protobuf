序列化方案主流协议：

XML 可读性好 数据冗长

JSON 起源于js，键值对描述对象，是ajax标准的协议格式

ProtoBuf 起源于google，序列化数据量小 解析快，它有简单好用的 IDL Complier 及清晰可读的 IDL 文件，非常适合于对性能要求高的 RPC 调用

FlatBuf 解码效率和内存优于protobuf，但序列化体积略大，生态不如pb

协议选型我们主要基于以下几个核心维度进行考量：首先关注性能指标，包括序列化/反序列化速度、传输体积和内存占用；其次评估开发成本，包括跨语言支持、工具链成熟度和学习曲线；最后考虑业务适配性

pb的二进制编码格式 传输效率很高，强类型IDL也可以自动生成多语言代码，序列化体积最小，相较于json的明文传输 二进制编码还有额外的安全优势

腾讯文档团队开发了面向腾讯文档的pb转ts工具

6.21

### protobuf workflow (compare with json)

json: 通常前后端没有一个**机器可读的、强制性的“契约”**，也需要在前端手动为每个接口的数据创建ts类型定义，这意味着后端接口一旦变更，文档可能更新不及时，前端的ts类型也需要手动修改

protobuf: 

1. 显式契约：所有的数据结构都必须在一个`.proto` 文件中清晰定义，这个文件就是前后端共同遵守的”契约“ **( interface definition language - IDL )**
2. IDL定义：使用pb的特定语法定义的数据结构，称之为`message` 

```protobuf
// 定义一个user消息
message User {
	int32 id = 1;
	string name = 2;
	string email = 3;
}
```

核心要素：

- 字段类型：强类型，如int32
- 字段编号(Field Number): 每个字段后面的 **= 1, = 2** 是该字段的唯一标识符，这是pb实现向后兼容、高校编解码的关键，**即使字段名改了，只要编号不变，旧的客户端依然能解析**

因此，json的契约是“软”的、人为的，pb的契约是“硬”的、代码化的

**pb的自动代码生成**

通常在package.json中配置一个npm script, 执行命令后生成：

1. ts接口：一个与`message User`对应的`interface User` 
2. 一个“管理器”对象：一个名为User的对象，它包含**序列化**和**反序列化**的核心方法，例如：
    1. `User.create(data)` 创建一个User消息实例
    2. `User.toBinary(msg)` 将消息实例序列化成二进制字节流(Uint8Array)
    3. `User.fromBinary(bytes)` 将二进制字节流反序列化成消息实例

什么是**反序列化？**

一个精确的、基于`.proto` 契约的逆向工程，把按字节排序好的积木(bytes)，倒入User模型的**专属拼装机(fromBinary)**方法里。这个User.fromBinary方法是由`protoc`根据`.proto` 文件自动生成的，它内部包含一份精确的拼装图纸，图纸来源于user.proto定义

**反直觉地纠正一下”res”**

`const res = await fetch(...` 中，res是http协议的Response Object, 它其实只是一个刚从货车上卸下来的、未开封的包裹，res本身不是我们最终想要的货物，它只包含货物的所有信息和**获取货物的方法：**

- 包裹状态：res.ok(包裹是否完好无损), res.status
- 包裹上的标签：res.headers
- 一个“开箱的拉环”：`res.json()`, `res.text()`, `res,arrayBuffer()`… 你只能选择其中一种方式打开这个包裹，一旦打开，包裹就空了

**因此，res不是数据本身，而是一个装着原始数据、并提供了开箱方法的容器**

**runtime**

```tsx
// 通过json.stringify()和res.json()来处理
const res = await fetch('api/xxx')
const user: User = await res.json()
return user

// pb: 手动处理二进制数据
const res = await ...
const buffer = await res.arrayBuffer() // 获取二进制数据ArrayBuffer
const bytes = new Uint8Array(buffer) // 转换为Uint8Array
const user = User.fromBinary(bytes) // 使用生成的代码进行反序列化

console.log(user.name) // 这样就可以直接访问属性
return user

// 如果是pb post请求，发送数据
const newUser = User.create({name, email}) // 创建消息实例
const binaryData = User.toBinary(newUser) // 序列化为二进制
await fetch('xx', {
	method: 'post',
	headers: {'Content-Type': 'application/protobuf'},
	body: binaryData,
})
```

**实践QA**

问题 1：从 .proto到 .ts 的第一步

看到这份 Management.proto 文件后，我作为一名前端工程师，第一步要做什么？我需要用到哪些核心命令行工具？能大致写出一个什么样的命令，才能把这个文件变成我可以在 TypeScript 项目中通过 import { ClearMcnReq } from '...' 来使用的模块？

### Remote Procedure Call：远程过程调用

让你调用远程服务器上的函数，就像调用本地函数一样，无需关心底层复杂的网络通信细节。它隐藏了网络协议、序列化/反序列化、错误处理等所有底层细节

| 特性 | RPC (以 gRPC 为例) | RESTful API |
| --- | --- | --- |
| **设计哲学** | **面向动作 (Action-Oriented)**<br>你调用一个“动词”，如 clearMcn()。 | **面向资源 (Resource-Oriented)**<br>你操作一个“名词”，如对 /users/123 这个资源执行 GET, POST, DELETE 操作。 |
| **契约** | **强契约**，由 .proto 文件严格定义。 | **弱契约**，依赖 OpenAPI/Swagger 文档（非强制）。 |
| **数据格式** | 通常是 Protobuf 等高效二进制格式。 | 通常是 JSON 等人类可读的文本格式。 |
| **传输协议** | 通常基于 HTTP/2，支持双向流等高级特性。 | 主要基于 HTTP/1.1。 |
| **代码生成** | **核心特性**。自动生成客户端和服务器端骨架代码。 | 不普遍，通常需要额外工具支持。 |
| **性能** | **极高**。二进制序列化 + HTTP/2。 | **良好**。但 JSON 解析和 HTTP/1.1 开销更大。 |
