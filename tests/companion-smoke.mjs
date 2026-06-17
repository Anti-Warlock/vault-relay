import assert from "node:assert/strict";
import path from "node:path";
import puppeteer from "puppeteer-core";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const contentScript = path.resolve("chrome-extension/content.js");
const licensingScript = path.resolve("chrome-extension/licensing.js");
const queueScript = path.resolve("chrome-extension/queue.js");

const cases = [
  {
    name: "x article draft bridge",
    platform: "x",
    url: "https://x.com/compose/articles#vault-relay-claim=smoke-one-time-claim",
    relayClaim: true,
    html: "<main>X Articles</main>",
    task: task("x", {
      mode: "x-article",
      xArticle: {
        blocks: [{
          key: "smoke",
          text: "X smoke article",
          type: "unstyled",
          data: {},
          entity_ranges: [],
          inline_style_ranges: []
        }],
        entity_map: []
      }
    }),
    verify: () => ({
      hash: location.hash,
      runtimeMessages: window.__runtimeMessages,
      articleRequest: window.__articleRequest
    }),
    assertResult: (result) => {
      assert.equal(result.hash, "");
      assert.ok(result.runtimeMessages.includes("CLAIM_RELAY_TASK"));
      assert.equal(result.articleRequest.content.mode, "x-article");
    }
  },
  {
    name: "zhihu competing contenteditable controls",
    platform: "zhihu",
    concurrentTriggers: true,
    url: "https://zhuanlan.zhihu.com/write",
    html: `<div class="title-editable" contenteditable="true" style="height:40px"></div>
      <textarea class="title-input" placeholder="请输入标题"></textarea>
      <section id="cover-section"><button type="button">添加文章封面</button>
      <input id="zhihu-cover" name="cover" type="file" accept="image/*"
        onchange="this.dataset.uploaded=String(this.files.length);let p=document.createElement('img');p.src='https://pic.zhimg.com/cover.png';document.querySelector('#cover-section').appendChild(p)"></section>
      <div class="ProseMirror article-editor" contenteditable="true" style="height:600px"
      onpaste="event.preventDefault();let s=getSelection(),r=s.getRangeAt(0);r.deleteContents();if(event.clipboardData.files.length){let i=document.createElement('img');i.src='https://pic.zhimg.com/uploaded-'+this.querySelectorAll('img').length+'.png';r.insertNode(i);r.setStartAfter(i)}else{this.dataset.textPastes=String(Number(this.dataset.textPastes||0)+1);let f=r.createContextualFragment(event.clipboardData.getData('text/html')),l=f.lastChild;r.insertNode(f);if(l)r.setStartAfter(l);this.dataset.prosemirrorState='updated'}r.collapse(true);s.removeAllRanges();s.addRange(r);this.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}))"></div>`,
    task: task("zhihu", {
      plainText: "Zhihu smoke body before image\n\nZhihu smoke body after image",
      richHtml: '<p>Zhihu smoke body before image</p><img src="https://oss.example/first.png" alt="first"><p>Zhihu smoke body between images</p><img src="https://oss.example/second.png" alt="second"><p>Zhihu smoke body after image</p>',
      images: [
        { kind: "remote", source: "https://oss.example/first.png", alt: "first" },
        { kind: "remote", source: "https://oss.example/second.png", alt: "second" }
      ],
      coverImage: { kind: "remote", source: "https://oss.example/first.png", alt: "first" }
    }),
    verify: () => [
      document.querySelector("textarea").value,
      document.querySelector(".ProseMirror").textContent,
      Array.from(document.querySelectorAll(".ProseMirror img")).map((image) => [image.getAttribute("src"), image.getAttribute("alt")]),
      document.querySelector("#zhihu-cover")?.dataset.uploaded,
      document.querySelector(".ProseMirror").dataset.prosemirrorState,
      document.querySelector(".ProseMirror").dataset.textPastes,
      Array.from(document.querySelector(".ProseMirror").childNodes).map((node) =>
        node.nodeName === "IMG" || node.querySelector?.("img")
          ? "image"
          : node.textContent.trim()
      ).filter(Boolean)
    ],
    assertResult: (result) => {
      assert.equal(result[0], "Smoke title");
      assert.match(result[1], /smoke body/i);
      assert.equal(result[2].length, 2);
      assert.deepEqual(result[2].map((image) => image[1]), [null, null]);
      assert.match(result[2][0][0], /^https:\/\/pic\.zhimg\.com\/uploaded-/);
      assert.equal(result[3], "1");
      assert.equal(result[4], "updated");
      assert.equal(result[5], "1");
      assert.deepEqual(result[6], [
        "Zhihu smoke body before image",
        "image",
        "Zhihu smoke body between images",
        "image",
        "Zhihu smoke body after image"
      ]);
    }
  },
  {
    name: "zhihu slow image upload never refills the article in the same page",
    platform: "zhihu",
    url: "https://zhuanlan.zhihu.com/write",
    expectWaiting: true,
    html: `<textarea class="title-input" placeholder="请输入标题"></textarea>
      <div class="ProseMirror article-editor" contenteditable="true" style="height:600px"
      onpaste="event.preventDefault();if(!event.clipboardData.files.length){this.insertAdjacentHTML('beforeend',event.clipboardData.getData('text/html'))};this.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}))"></div>`,
    task: task("zhihu", {
      plainText: "Zhihu smoke body slow upload",
      richHtml: '<p>Zhihu smoke body slow upload</p><img src="https://oss.example/slow.png" alt="slow">',
      images: [{ kind: "remote", source: "https://oss.example/slow.png", alt: "slow" }]
    }),
    verify: () => [
      document.querySelector("textarea").value,
      document.querySelector(".ProseMirror").textContent,
      (document.querySelector(".ProseMirror").textContent.match(/Zhihu smoke body slow upload/g) ?? []).length,
      (document.querySelector(".ProseMirror").textContent.match(/上传失败请手动补图/g) ?? []).length
    ],
    assertResult: (result) => {
      assertTitleAndBody(result);
      assert.equal(result[2], 1);
      assert.equal(result[3], 1);
    }
  },
  {
    name: "zhihu refuses image paste when marker deletion did not move the editor cursor",
    platform: "zhihu",
    url: "https://zhuanlan.zhihu.com/write",
    expectWaiting: true,
    rejectDeletePosition: true,
    html: `<textarea class="title-input" placeholder="请输入标题"></textarea>
      <div class="ProseMirror article-editor" contenteditable="true" style="height:600px"
      onpaste="event.preventDefault();if(event.clipboardData.files.length){let i=document.createElement('img');i.src='https://pic.zhimg.com/wrong-end.png';this.appendChild(i)}else{this.innerHTML=event.clipboardData.getData('text/html')}"></div>`,
    task: task("zhihu", {
      plainText: "Zhihu smoke body guarded position",
      richHtml: '<p>Zhihu smoke body guarded position</p><img src="https://oss.example/guarded.png" alt="guarded">',
      images: [{ kind: "remote", source: "https://oss.example/guarded.png", alt: "guarded" }]
    }),
    verify: () => [
      document.querySelector(".ProseMirror").textContent,
      document.querySelectorAll(".ProseMirror img").length
    ],
    assertResult: (result) => {
      assert.match(result[0], /上传失败请手动补图/);
      assert.equal(result[1], 0);
    }
  },
  {
    name: "wechat home opens article editor",
    platform: "wechat",
    url: "https://mp.weixin.qq.com/",
    openingOnly: true,
    html: `<section><h2>&#x65B0;&#x7684;&#x521B;&#x4F5C;</h2><button type="button" style="width:100px;height:40px" onclick="document.body.dataset.articleOpened='true'">&#x6587;&#x7AE0;</button><span>&#x9009;&#x62E9;&#x5DF2;&#x6709;&#x5185;&#x5BB9;</span></section>`,
    task: task("wechat", { richHtml: "<p>WeChat home smoke body</p>" }),
    verify: () => document.body.dataset.articleOpened,
    assertResult: (result) => assert.equal(result, "true")
  },
  {
    name: "wechat iframe editor with hosted body image and cover",
    platform: "wechat",
    url: "https://mp.weixin.qq.com/",
    html: `<div class="js_title_main appmsg_edit_item title">
        <textarea id="title" name="title" placeholder="请在这里输入标题" style="height:0;width:578px;padding:0;border:0"></textarea>
        <div class="ProseMirror" contenteditable="true" style="height:30px;width:578px"></div>
      </div>
      <input id="author" placeholder="请输入作者">
      <textarea id="js_description" class="frm_textarea js_desc js_counter js_field" name="digest" placeholder="选填，不填写则默认抓取正文开头部分文字"></textarea>
      <section id="js_cover_area"><span>&#x5C01;&#x9762;</span>
        <div class="select-cover__btn js_cover_btn_area select-cover__mask" style="cursor:pointer" onclick="document.querySelector('.js_cover_opr').style.display='block'">
          <span id="empty-cover" class="btn-text js_share_type_none_image">&#x62D6;&#x62FD;&#x6216;&#x9009;&#x62E9;&#x5C01;&#x9762;</span>
          <span class="btn-text js_share_type_image" style="display:none">&#x9ED8;&#x8BA4;&#x9996;&#x56FE;&#x4E3A;&#x5C01;&#x9762;</span>
        </div>
        <div class="pop-opr__group js_cover_opr js_cover_btn_area" style="display:none">
          <ul class="pop-opr__list"><li class="pop-opr__item">
            <a class="pop-opr__button js_selectCoverFromContent" onclick="document.querySelector('.current-wechat-image-picker').style.display='block'">&#x4ECE;&#x6B63;&#x6587;&#x9009;&#x62E9;</a>
          </li></ul>
        </div>
      </section>
      <div class="weui-desktop-dialog current-wechat-image-picker" style="display:none;width:600px;height:400px">&#x9009;&#x62E9;&#x56FE;&#x7247;
        <p>&#x8BF7;&#x4ECE;&#x6B63;&#x6587;&#x63D2;&#x5165;&#x7684;&#x56FE;&#x7247;&#x548C;&#x89C6;&#x9891;&#x5C01;&#x9762;&#x4E2D;&#x9009;&#x62E9;&#x5C01;&#x9762;</p>
        <ul class="appmsg_content_img_list"><li class="appmsg_content_img_item" style="width:100px;height:100px;cursor:pointer" onclick="this.classList.add('selected');let b=this.closest('.current-wechat-image-picker').querySelector('button');b.classList.remove('weui-desktop-btn_disabled')"><div style="width:90px;height:90px"><img src="https://mmbiz.qpic.cn/body.png" style="width:80px;height:80px"></div></li></ul>
        <button type="button" class="weui-desktop-btn_disabled" onclick="if(this.classList.contains('weui-desktop-btn_disabled'))return;this.closest('.current-wechat-image-picker').style.display='none';document.querySelector('.wechat-cover-crop-dialog').style.display='block'">&#x4E0B;&#x4E00;&#x6B65;</button>
      </div>
      <div class="weui-desktop-dialog wechat-cover-crop-dialog" style="display:none;width:600px;height:400px">&#x7F16;&#x8F91;&#x5C01;&#x9762;
        <button type="button" class="weui-desktop-btn weui-desktop-btn_primary" onclick="this.closest('.wechat-cover-crop-dialog').style.display='none';document.querySelector('#empty-cover').style.display='none';document.querySelector('#js_description').value='WeChat smoke body auto digest';let p=document.createElement('div');p.className='js_cover_preview_new select-cover__preview first_appmsg_cover';p.style.height='80px';let i=document.createElement('img');i.src='https://mmbiz.qpic.cn/cover.png';p.appendChild(i);document.querySelector('#js_cover_area').appendChild(p)">&#x786E;&#x8BA4;</button>
      </div>
      <iframe id="ueditor_0" srcdoc="<body contenteditable='true' data-reject-image-paste='true' style='height:600px'></body>"></iframe>`,
    task: task("wechat", {
      richHtml: '<p>WeChat smoke body</p><img src="https://oss.example/wechat.png" alt="wechat">',
      images: [{ kind: "remote", source: "https://oss.example/wechat.png", alt: "wechat" }],
      coverImage: { kind: "remote", source: "https://oss.example/wechat.png", alt: "wechat" }
    }),
    verify: () => [
      document.querySelector(".js_title_main .ProseMirror").textContent,
      document.querySelector("#ueditor_0").contentDocument.body.textContent,
      Array.from(document.querySelector("#ueditor_0").contentDocument.body.querySelectorAll("img")).map((image) => image.src),
      document.querySelector("#js_cover_area img")?.src ?? "",
      document.querySelector("#ueditor_0").contentDocument.body.dataset.editorState,
      document.querySelector("#js_description").value
    ],
    assertResult: (result) => {
      assertTitleAndBody(result);
      assert.doesNotMatch(result[1], /上传失败请手动补图|VAULTRELAYIMAGE/);
      assert.deepEqual(result[2], ["https://mmbiz.qpic.cn/uploaded.png"]);
      assert.match(result[3], /mmbiz\.qpic\.cn\/cover\.png/);
      assert.equal(result[4], "updated");
      assert.equal(result[5], "");
    }
  },
  {
    name: "wechat keeps a clean draft when body image hosting is rejected",
    platform: "wechat",
    url: "https://mp.weixin.qq.com/",
    expectImagesHostedFalse: true,
    html: `<div id="js_title" contenteditable="true" data-placeholder="请输入标题"></div>
      <iframe id="ueditor_0" srcdoc="<body contenteditable='true' data-reject-image-paste='true' data-no-host='true' style='height:600px'></body>"></iframe>`,
    task: task("wechat", {
      plainText: "WeChat smoke body clean fallback",
      richHtml: '<p>WeChat smoke body clean fallback</p><img src="https://oss.example/rejected.png" alt="rejected">',
      images: [{ kind: "remote", source: "https://oss.example/rejected.png", alt: "rejected" }]
    }),
    verify: () => [
      document.querySelector("#js_title").textContent,
      document.querySelector("#ueditor_0").contentDocument.body.textContent
    ],
    assertResult: (result) => {
      assertTitleAndBody(result);
      assert.doesNotMatch(result[1], /上传失败请手动补图|VAULTRELAYIMAGE/);
    }
  },
  {
    name: "xiaohongshu text fields",
    platform: "xiaohongshu",
    url: "https://creator.xiaohongshu.com/publish/publish",
    html: `<input id="video-upload" type="file" accept="video/*">
      <input id="image-upload" type="file" accept="image/*" multiple onchange="this.insertAdjacentHTML('afterend','<img alt=smoke src=data:image/png;base64,iVBORw0KGgo=>')">
      <input class="title-input" placeholder="填写标题"><textarea class="body-input" placeholder="填写正文"></textarea>`,
    task: task("xiaohongshu", {
      images: [{
        kind: "remote",
        source: "https://oss.example/smoke.png",
        alt: "smoke",
        fileName: "smoke.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,iVBORw0KGgo="
      }]
    }),
    verify: () => [
      document.querySelector(".title-input").value,
      document.querySelector(".body-input").value,
      document.querySelector("#video-upload").files.length,
      document.querySelector("#image-upload").files.length,
      window.__runtimeMessages
    ],
    assertResult: (result) => {
      assertTitleAndBody(result);
      assert.equal(result[2], 0);
      assert.equal(result[3], 1);
      assert.equal(result[4].includes("FETCH_REMOTE_IMAGE"), false);
    }
  },
  {
    name: "xiaohongshu long-form landing opens creation",
    platform: "xiaohongshu",
    url: "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=article",
    openingOnly: true,
    html: `<main><button type="button" style="width:120px;height:40px" onclick="document.body.dataset.articleOpened='true'">&#x65B0;&#x7684;&#x521B;&#x4F5C;</button><div>&#x652F;&#x6301;&#x5343;&#x5B57;&#x957F;&#x6587;</div></main>`,
    task: task("xiaohongshu", {
      mode: "article",
      richHtml: "<p>xiaohongshu long-form landing body</p>"
    }),
    verify: () => document.body.dataset.articleOpened,
    assertResult: (result) => assert.equal(result, "true")
  },
  {
    name: "xiaohongshu article editor",
    platform: "xiaohongshu",
    concurrentTriggers: true,
    url: "https://creator.xiaohongshu.com/publish/publish?target=article",
    html: `<input class="title-input" placeholder="填写标题">
      <section id="xiaohongshu-shell">
      <div class="ProseMirror article-editor" contenteditable="true" style="height:600px"
      onpaste="event.preventDefault();let s=getSelection(),r=s.getRangeAt(0);r.deleteContents();if(event.clipboardData.files.length){let i=document.createElement('img');i.src='https://ci.xiaohongshu.com/uploaded-'+this.querySelectorAll('img').length+'.png';r.insertNode(i);let p=document.createElement('p');p.appendChild(document.createElement('br'));i.parentElement.insertAdjacentElement('afterend',p);r.setStartAfter(i);this.dataset.filePastes=String(Number(this.dataset.filePastes||0)+1);if(this.dataset.filePastes==='3'){setTimeout(()=>Array.from(this.querySelectorAll('img')).slice(0,3).forEach((image)=>this.appendChild(image.cloneNode())),3500)}}else{let f=r.createContextualFragment(event.clipboardData.getData('text/html')),l=f.lastChild;r.insertNode(f);if(l)r.setStartAfter(l)}r.collapse(true);s.removeAllRanges();s.addRange(r);this.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}))"></div></section>
      <script>document.querySelector('#xiaohongshu-shell').addEventListener('paste',(event)=>{if(event.clipboardData.files.length){let i=document.createElement('img');i.src='https://ci.xiaohongshu.com/duplicate-from-capture-handler.png';document.querySelector('.ProseMirror').appendChild(i)}},true)</script>`,
    task: task("xiaohongshu", {
      mode: "article",
      plainText: "xiaohongshu smoke body before image\n\nxiaohongshu smoke body after image",
      richHtml: '<p>xiaohongshu smoke body before image</p><img src="https://oss.example/red-first.png" alt="red-first"><p>xiaohongshu smoke body between images</p><img src="https://oss.example/red-second.png" alt="red-second"><p>xiaohongshu smoke body after image</p><img src="https://oss.example/red-last.png" alt="red-last">',
      images: [
        { kind: "remote", source: "https://oss.example/red-first.png", alt: "red-first" },
        { kind: "remote", source: "https://oss.example/red-second.png", alt: "red-second" },
        { kind: "remote", source: "https://oss.example/red-last.png", alt: "red-last" }
      ]
    }),
    verify: () => [
      document.querySelector(".title-input").value,
      document.querySelector(".ProseMirror").textContent,
      Array.from(document.querySelectorAll(".ProseMirror img")).map((image) => image.src),
      (document.querySelector(".ProseMirror").textContent.match(/上传失败请手动补图/g) ?? []).length,
      Array.from(document.querySelectorAll(".ProseMirror p")).filter((paragraph) => !paragraph.textContent.trim() && !paragraph.querySelector("img")).length,
      Array.from(document.querySelector(".ProseMirror").childNodes).map((node) =>
        node.nodeName === "IMG" || node.querySelector?.("img")
          ? "image"
          : node.textContent.trim()
      ).filter(Boolean)
    ],
    assertResult: (result) => {
      assertTitleAndBody(result);
      assert.equal(result[2].length, 3);
      assert.equal(result[3], 0);
      assert.equal(result[4], 0);
      assert.deepEqual(result[5], [
        "xiaohongshu smoke body before image",
        "image",
        "xiaohongshu smoke body between images",
        "image",
        "xiaohongshu smoke body after image",
        "image"
      ]);
    }
  },
  {
    name: "xiaohongshu keeps a clean article when image paste is rejected",
    platform: "xiaohongshu",
    url: "https://creator.xiaohongshu.com/publish/publish?target=article",
    expectImagesHostedFalse: true,
    expectWaiting: true,
    html: `<input class="title-input" placeholder="填写标题">
      <div class="ProseMirror article-editor" contenteditable="true" style="height:600px"
      onpaste="event.preventDefault();if(!event.clipboardData.files.length){this.innerHTML=event.clipboardData.getData('text/html');this.querySelectorAll('img').forEach((i)=>i.remove());this.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}))}"></div>`,
    task: task("xiaohongshu", {
      mode: "article",
      plainText: "xiaohongshu smoke body clean fallback",
      richHtml: '<p>xiaohongshu smoke body clean fallback</p><img src="https://oss.example/red-rejected.png" alt="red-rejected">',
      images: [{ kind: "remote", source: "https://oss.example/red-rejected.png", alt: "red-rejected" }]
    }),
    verify: () => [
      document.querySelector(".title-input").value,
      document.querySelector(".ProseMirror").textContent,
      document.querySelectorAll(".ProseMirror img").length
    ],
    assertResult: (result) => {
      assertTitleAndBody(result);
      assert.doesNotMatch(result[1], /上传失败请手动补图/);
      assert.equal(result[2], 0);
    }
  }
];

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
try {
  for (const item of cases) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      request.respond({
        status: 200,
        contentType: "text/html",
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: item.html
      });
    });
    await page.evaluateOnNewDocument(({ pending, relayClaim, platform, concurrentTriggers, rejectDeletePosition }) => {
      window.MutationObserver = class {
        observe() {}
        disconnect() {}
      };
      window.__vaultRelayStatus = {};
      window.__runtimeMessages = [];
      window.__clipboardText = "";
      window.__pendingPlatformKey = `pendingPlatformFill:${platform}`;
      window.__storage = relayClaim ? {} : { [window.__pendingPlatformKey]: pending };
      window.addEventListener("message", (event) => {
        if (event.data?.type !== "__vault_relay_x_article_create_request__") return;
        window.__articleRequest = event.data.task;
        window.postMessage({
          type: "__vault_relay_x_article_create_response__",
          requestId: event.data.requestId,
          ok: true,
          articleId: "123456",
          uploadedImageCount: event.data.task.content.images.length,
          editorUrl: location.href
        }, location.origin);
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__clipboardText = text;
          }
        }
      });
      document.execCommand = (command, _showUi, value) => {
        const editor = document.activeElement;
        if (!(editor instanceof HTMLElement)) return false;
        if (command === "delete") {
          if (rejectDeletePosition) return true;
          const selection = document.getSelection();
          if (!selection?.rangeCount) return false;
          selection.getRangeAt(0).deleteContents();
          editor.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "deleteContent"
          }));
          return true;
        }
        const text = command === "paste" ? window.__clipboardText : value;
        if (command !== "paste" && command !== "insertText") return false;
        const beforeInput = new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text
        });
        const handled = !editor.dispatchEvent(beforeInput);
        if (!handled) {
          const selection = document.getSelection();
          if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            editor.textContent = text;
          }
        }
        editor.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text
        }));
        return true;
      };
      window.chrome = {
        storage: {
          local: {
            get: async (keys) => {
              if (concurrentTriggers) await new Promise((resolve) => setTimeout(resolve, 75));
              if (typeof keys === "string") return { [keys]: window.__storage[keys] };
              if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, window.__storage[key]]));
              return { ...window.__storage };
            },
            set: async (value) => {
              Object.assign(window.__storage, value);
              Object.assign(window.__vaultRelayStatus, value);
            },
            remove: async (keys) => {
              const values = Array.isArray(keys) ? keys : [keys];
              values.forEach((key) => delete window.__storage[key]);
              if (values.includes(window.__pendingPlatformKey) || values.includes("pendingPlatformFill")) {
                window.__vaultRelayRemoved = true;
              }
            }
          },
          onChanged: { addListener: () => {} }
        },
        runtime: {
          onMessage: {
            addListener: (listener) => {
              window.__probeListener = listener;
            }
          },
          sendMessage: async (message) => {
            window.__runtimeMessages.push(message?.type);
            if (message?.type === "CLAIM_RELAY_TASK") {
              assertClaim(message);
              return { ok: true, task: pending };
            }
            return {
              ok: true,
              image: {
                dataUrl: "data:image/png;base64,iVBORw0KGgo=",
                fileName: "smoke.png",
                type: "image/png"
              }
            };
          }
        }
      };
      function assertClaim(message) {
        if (message.claimCode !== "smoke-one-time-claim") throw new Error("relay claim code mismatch");
      }
    }, {
      pending: item.task,
      relayClaim: item.relayClaim === true,
      platform: item.platform,
      concurrentTriggers: item.concurrentTriggers === true,
      rejectDeletePosition: item.rejectDeletePosition === true
    });
    await page.goto(item.url);
    if (item.platform === "wechat" && !item.openingOnly) {
      await page.evaluate(() => {
        const body = document.querySelector("#ueditor_0").contentDocument.body;
        body.addEventListener("paste", (event) => {
          event.preventDefault();
          if (event.clipboardData.files.length) {
            if (body.dataset.rejectImagePaste === "true") return;
            const range = body.ownerDocument.getSelection().getRangeAt(0);
            range.deleteContents();
            const image = body.ownerDocument.createElement("img");
            image.src = "https://mmbiz.qpic.cn/uploaded.png";
            image.style.width = "100px";
            image.style.height = "100px";
            range.insertNode(image);
          } else {
            body.innerHTML = event.clipboardData.getData("text/html");
            body.dataset.editorState = "updated";
          }
          body.dispatchEvent(new body.ownerDocument.defaultView.InputEvent("input", {
            bubbles: true,
            inputType: "insertFromPaste"
          }));
        });
        body.addEventListener("input", () => {
          if (body.dataset.noHost === "true") return;
          body.querySelectorAll('img[src^="data:"]').forEach((image) => {
            image.src = "https://mmbiz.qpic.cn/uploaded.png";
          });
        });
      });
    }
    await page.addScriptTag({ path: licensingScript });
    await page.addScriptTag({ path: queueScript });
    await page.addScriptTag({ path: contentScript });
    if (item.concurrentTriggers) {
      await page.evaluate(() => Promise.all([
        fillPendingTask(),
        fillPendingTask(),
        fillPendingTask()
      ]));
    }
    try {
      await page.waitForFunction(
        (options) => options.openingOnly
          ? document.body.dataset.articleOpened === "true"
          : options.expectWaiting
            ? window.__vaultRelayStatus.lastFillStatus?.status === "waiting"
            : options.concurrentTriggers
              ? window.__vaultRelayStatus.lastFillStatus?.status === "ready"
            : window.__vaultRelayRemoved === true,
        { timeout: 45000 },
        {
          openingOnly: item.openingOnly === true,
          expectWaiting: item.expectWaiting === true,
          concurrentTriggers: item.concurrentTriggers === true
        }
      );
      if (item.expectWaiting) {
        await page.evaluate(async () => {
          await fillPendingTask();
          await fillPendingTask();
        });
      }
    } catch (error) {
      const status = await page.evaluate(() => window.__vaultRelayStatus);
      const debug = await page.evaluate(() => Array.from(document.querySelectorAll("input,textarea,[contenteditable=true]")).map((element) => ({
        tag: element.tagName,
        placeholder: element.getAttribute("placeholder"),
        className: element.className,
        visible: element.offsetParent !== null
      })));
      const frameDebug = await page.evaluate(() => Array.from(document.querySelectorAll("iframe")).map((frame) => ({
        id: frame.id,
        bodyText: frame.contentDocument?.body?.textContent,
        bodyHtml: frame.contentDocument?.body?.innerHTML,
        images: Array.from(frame.contentDocument?.body?.querySelectorAll("img") ?? []).map((image) => image.src)
      })));
      throw new Error(`${item.platform} adapter failed: ${JSON.stringify({ status, debug, frameDebug })}`, { cause: error });
    }
    const result = await page.evaluate(item.verify);
    const probe = await page.evaluate(() => new Promise((resolve) => {
      window.__probeListener({ type: "PROBE_PAGE" }, {}, resolve);
    }));
    const queue = await page.evaluate(() => window.__vaultRelayStatus.publicationQueue);
    assert.equal(probe.ok, true);
    assert.equal(probe.probe.platform, item.platform);
    assert.equal(queue?.[0]?.status, item.openingOnly ? "opening" : item.expectWaiting ? "waiting" : "ready");
    assert.equal(queue?.[0]?.attempts, 1);
    if (item.platform === "zhihu" && !item.expectWaiting) {
      assert.notEqual(queue?.[0]?.diagnostics?.imageOrderOk, false);
      assert.notEqual(queue?.[0]?.diagnostics?.imagesHosted, false);
      assert.equal(queue?.[0]?.diagnostics?.coverSet, true, JSON.stringify({ diagnostics: queue?.[0]?.diagnostics, result }));
    }
    if (item.platform === "wechat" && !item.openingOnly) {
      assert.equal(queue?.[0]?.diagnostics?.imagesHosted, item.expectImagesHostedFalse ? false : true);
      if (!item.expectImagesHostedFalse) {
        assert.equal(queue?.[0]?.diagnostics?.coverSet, item.expectCoverFalse ? false : true, JSON.stringify({ diagnostics: queue?.[0]?.diagnostics, result }));
      }
    }
    if (item.platform === "xiaohongshu" && item.task.content.mode === "article" && !item.openingOnly && !item.expectWaiting) {
      assert.equal(queue?.[0]?.diagnostics?.imagesHosted, item.expectImagesHostedFalse ? false : true);
      if (!item.expectImagesHostedFalse) {
        assert.equal(queue?.[0]?.diagnostics?.imagesOk, true);
        assert.equal(queue?.[0]?.diagnostics?.imageCountExact, true);
      }
    }
    item.assertResult(result);
    console.log(`ok - ${item.name}`);
    await page.close();
  }
} finally {
  await browser.close();
}

function assertTitleAndBody(result) {
  assert.equal(result[0], "Smoke title");
  assert.match(result[1], /smoke body/i);
}

function task(platform, overrides = {}) {
  return {
    version: 2,
    generatorVersion: "0.9.0",
    id: `smoke-${platform}`,
    platform,
    title: "Smoke title",
    sourcePath: "smoke.md",
    createdAt: new Date().toISOString(),
    editorUrl: "https://example.com",
    issues: [],
    content: {
      plainText: `${platform} smoke body`,
      images: [],
      ...overrides
    }
  };
}
