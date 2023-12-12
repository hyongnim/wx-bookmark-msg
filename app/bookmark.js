const needle = require("needle");

const { WX_TOKEN, WX_APPID, WX_APPSECRET, WX_AESKEY, MP_ID, API_BASE } =
  process.env;

module.exports = {
  wxConfig: {
    token: WX_TOKEN,
    appId: WX_APPID,
    appSecret: WX_APPSECRET,
    encodingAESKey: WX_AESKEY,
  },
  async getMsgList(query) {
    if (!query.openid) {
      throw new Error("no openid"); // 只允许获取用户本人的公众号消息
    }
    const { body } = await needle("post", API_BASE + "/data/list/wxmsg", query);
    return body;
  },
  listen(wxApp) {
    wxApp.subscribe((acc) => {
      acc.send.sendTxtMsg(
        `hi~我是收藏小助手，\n向我发送内容即加入${this.getMpLink(
          "合集",
          `/pages/index/index?fromUser=${acc.fromUser}`
        )}，\n\n当前支持文字、图片、语音`
      );
    });
    wxApp.text(/.+/, async (acc) => {
      let type = /^https?:\/\/[^\s]+/.test(acc.content) ? "link" : "note";
      if (acc.content == "【收到不支持的消息类型，暂无法显示】") {
        type = "";
      }
      this.onReply(acc, type);
    });
    const mediaList = ["image", "voice", "video"];
    for (const type of mediaList) {
      wxApp[type]((acc) => {
        this.onReply(acc, type);
      });
    }
  },
  getMpLink(label = "小程序", path = "/pages/index/index") {
    return `<a data-miniprogram-appid="${MP_ID}" data-miniprogram-path="${path}">${label}</a>`;
  },
  onReply(acc, type) {
    const sendMsg = acc.send.sendTxtMsg;
    if (!type) {
      sendMsg("暂未支持此消息类型");
      return;
    }
    if (type == "video") {
      // 视频文件较大，为节省服务器资源
      sendMsg(`当前仅支持在${this.getMpLink()}中收藏视频`);
      return;
    }
    this.saveMsg(acc, type); // 经测试，似乎无法使用await等待保存后回复消息
    const name = {
      note: "笔记",
      link: "链接",
      voice: "语音",
      image: "图片",
      video: "视频",
    }[type];
    const msg = this.getMpLink(
      `${name}+1`,
      `/pages/index/index2?sid=1&type=${type}&from=index&msgId=${acc.msgId}&fromUser=${acc.fromUser}`
    );
    sendMsg(msg);
  },
  async saveMsg(acc, type) {
    const {
      fromUser: openid,
      createTime: createAt,
      content: text,
      msgId,
      mediaId,
      thumbMediaId: thumbId,
    } = acc;
    return this.postMsg({
      openid,
      createAt,
      type,
      text,
      msgId,
      mediaId,
      thumbId,
    });
  },
  async postMsg(body) {
    const res = await needle("post", API_BASE + "/data/upsert/wxmsg", body);
    return res.body;
  },
};
