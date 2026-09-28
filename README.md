# codebits

码字位流台（原生 ES 模块，零依赖）：上面一个文本框，改动文本就能看频率怎么变、树怎么长、每个字符领到什么码字、位串怎么装进字节，还有补位与不变量读数。

## 起服务看页面

    python3 -m http.server 8000

浏览器打开 http://127.0.0.1:8000/ 即可操作。

## 测试

    node tests/run.js

## 场景自检

    node check_sample.js
