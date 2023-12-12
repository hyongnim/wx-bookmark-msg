const dotenv = require("dotenv");
dotenv.config(); // 本地读取.env，腾讯云托管在后台配置环境变量

const Koa = require("koa");
const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");
// const Cors = require("koa2-cors");
const XmlParser = require("koa-xml-body");
const Wetchat = require("koa-wechat-public");
const bookmark = require("./app/bookmark");

const appid = process.env.WX_APPID;

// 公众号消息监听
const wxApp = new Wetchat(bookmark.wxConfig);
bookmark.listen(wxApp);

const app = new Koa();
const router = new Router();

router.get("/", async (ctx) => {
  ctx.body = {
    version: "1.0.3", // 每次部署前，可修改此版本号，部署后可对比确认已上线，todo：脚本自增并push
    appid, // 用于确认环境变量生效
  };
});

// 客户端获取用户本人的公众号消息
router.all("/list/wxmsg", async (ctx) => {
  const query = {
    ...ctx.query,
    ...ctx.request.body,
  };
  const data = await bookmark.getMsgList(query);
  ctx.body = data;
});

// 捕获错误，返回500状态和提示
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.statusCode || err.status || 500;
    ctx.body = {
      msg: err.message || err,
    };
  }
});

app.use(new XmlParser());
router.all("/wechat", wxApp.start());

app
  // .use(Cors()) // 本地跨域调试
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log(`start on http://localhost:` + port);
});
