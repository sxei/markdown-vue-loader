let marked = require('marked');
let fs = require('fs');
let path = require('path');
let loaderUtils = require('loader-utils');

let cachePath = path.resolve(process.cwd(), './node_modules/.markdown-vue-cache');
if(!fs.existsSync(cachePath)) fs.mkdirSync(cachePath);

module.exports = function(content) {
	this.cacheable(); // 启用缓存提升效率
    let fileName = path.basename(this.resourcePath, '.md'); // 不包含后缀的文件名
    let demos = [];
    content = content.replace(/(^|\r|\n|\r\n):::[\s\S]*?```html(\r|\n|\r\n)([\s\S]+?)```[\s\S]*?:::(\r|\n|\r\n|$)/g, function(m, $1, $2, $3){
        let demoName = `${fileName}Demo${demos.length+1}.vue`;
        demos.push(demoName);
        fs.writeFileSync(path.join(cachePath, demoName), $3, 'utf8');
        // 组件名称，驼峰转中划线
        let componentName = toUnderline(demoName.replace(/\.vue$/g, ''), '-');
        // vue会误把textarea中的{{}}内容也当成插值处理，所以这里临时替换掉，代码高亮的时候再还原回来
        $3 = $3.replace(/{{/g, '{_{');
        return `<demoblock>
                    <${componentName} slot="demo"></${componentName}>
                    <textarea slot="code" class="language-markup">${$3}</textarea>
                </demoblock>`;
    });
	content = marked(content); // markdown转HTML
    let outPath = path.join(cachePath, fileName+'.vue');
    content = `<template><section>${content}</section></template>`;
    // marked在解析markdown中内嵌的html时，无法识别<demo-block>这种不规范的HTML，所以这里我们改成<demoblock>
    let importDemos = [`import Demoblock from '../../docs/_layout/demo-block.vue';`], demoNames = ['Demoblock'];
    demos.forEach(demo => {
        let name = toHump(demo.replace(/\.vue$/, ''), '-');
        demoNames.push(name);
        importDemos.push(`import ${name} from './${demo}';`);
    });
    content += `
        <script>
            ${importDemos.join('\n')}
            export default {
                components: {
                    ${demoNames.join(',')}
                },
                mounted() {
                    Prism.highlightAllTextarea();
                    var tabels = document.querySelectorAll('table');
                    Array.prototype.slice.apply(tabels).forEach(ele => ele.className = 'table table-bordered table-striped table-hover');
                }
            }
        </script>`;
    fs.writeFileSync(outPath, content, 'utf8'); // 写入临时vue文件中
    return 'module.exports = require(' +
        loaderUtils.stringifyRequest(this, '!!vue-loader!' + outPath) +
    ');'
};

/**
 * 字符串转下划线形式，示例：getParam 转 get_param，abc/def/TestDemo 转 abc/def/test-demo <br>
 * @param str 
 * @param flag 默认下划线-，也可以传其它字符
 */
let toUnderline = function(str, flag) {
    return str.replace(/(^|.)([A-Z])/g, (m, $1, $2) => {
        return $1 + (/\w/g.test($1) ? '-' : '') + $2.toLowerCase();
    });
};
/**
 * 字符串转驼峰形式<br>
 * 示例一：xei.toHump('get_param')，返回getParam<br>
 * 示例二：xei.toHump('font-size','-')，返回fontSize
 * @param str
 * @param 分割的标志，默认为“_”
 */
let toHump = function(str, flag) {
    return str.replace(new RegExp((flag || '_')+'(\\w)', 'g'), function(m, $1, idx, str){ return $1.toUpperCase(); });
};