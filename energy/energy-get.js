const puppeteer = require('puppeteer-core');
module.exports = function (RED) {

    function Mosenergy(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const configLogin = config.login;
        const configPassword = config.password;
        const configMosenergo_accnum = config.mosenergo_accnum;
        const configMosenergo_cntnum = config.mosenergo_cntnum;

        function validateParams(login, password, mosenergo_accnum, mosenergo_cntnum) {
            if (!login) {
                node.send([null, 'Не указан Логин в msg.login или конфигурации ноды']);
                return false;
            }
            if (!password) {
                node.send([null, 'Не указан Пароль в msg.password или конфигурации ноды']);
                return false;
            }
            if (!mosenergo_accnum) {
                node.send([null, 'Не указан Номер Счета в msg.mosenergo_accnum или конфигурации ноды']);
                return false;
            }
            if (!mosenergo_cntnum) {
                node.send([null, 'Не указан Номер Счетчика в msg.mosenergo_cntnum или конфигурации ноды']);
                return false;
            }

            return true;
        }

        function getOptions(executablePath) {
            let options = {};
            options.executablePath = executablePath || '/usr/bin/chromium-browser';
            options.slowMo = 100;
            return options;
        }

        node.on('input', function (msg) {
            var url = 'https://www.mos.ru/pgu/ru/application/mosenergo/counters/';
            const login = msg.login || configLogin;
            const password = msg.password || configPassword;
            const mosenergo_accnum = msg.mosenergo_accnum || configMosenergo_accnum;
            const mosenergo_cntnum = msg.mosenergo_cntnum || configMosenergo_cntnum;
            if (!validateParams(login, password, mosenergo_accnum, mosenergo_cntnum)) {
                return;
            }
            (async () => {
                let browser;
                try {
                    node.status({fill: "green", shape: "dot", text: 'Запуск браузера'});
                    const options = getOptions(msg.executablePath);
                    browser = await puppeteer.launch(options);
                    node.status({fill: "green", shape: "dot", text: 'Загрузка страницы'});
                    const context = await browser.createIncognitoBrowserContext();
                    const page = await context.newPage();
                    await page.goto(url);
                    node.status({fill: "green", shape: "dot", text: 'Авторизация'});
                    await page.waitForSelector('#login', { timeout: 10000 });
                    node.status({fill: "green", shape: "dot", text: 'Логин'});
                    await page.click('#login');
                    await page.keyboard.type(login);
                    node.status({fill: "green", shape: "dot", text: 'Пароль'});
                    await page.click('#password');
                    await page.keyboard.type(password);
                    node.status({fill: "green", shape: "dot", text: 'Вход'});
                    await page.click('#bind');
                    await page.waitForSelector('#MES_ACCOUNT', { timeout: 10000 });
                    node.status({fill: "green", shape: "dot", text: 'Авторизация успешна'});

                    url = "https://www.mos.ru/pgu/common/ajax/index.php?";
                    url += "ajaxModule=Mosenergo&ajaxAction=qMpguCheckShetch&items%5Bcode%5D=";
                    url += mosenergo_accnum + "&items%5Bnn_schetch%5D=" + mosenergo_cntnum;

                    await page.goto(url);
                    var content = await page.content();
                    content = content.match(/\{\".*\}\}/);
                    content = content[0];
                    content = JSON.parse(content);



                    msg.id_kng = content.result.id_kng;
                    msg.schem = content.result.schema;
                    node.status({fill: "green", shape: "dot", text: 'Загрузка данных'});

                    url = "https://www.mos.ru/pgu/common/ajax/index.php?";
                    url += "ajaxModule=Mosenergo&ajaxAction=qMpguGetLastPok&items%5Bcode%5D=";
                    url += mosenergo_accnum + "&items%5Bid_kng%5D=";
                    url += content.result.id_kng + "&items%5Bs%D1%81hema%5D=" + content.result.schema;

                    await page.goto(url);
                    content = await page.content();
                    content = content.match(/\{\".*\}\}/);
                    content = content[0];
                    content = JSON.parse(content);
                    msg.content = content;

                    var energyData = "";
                    
                    for (var i = 1; i < 4; i++) {
                        energyData += eval("content.result.pok_t" + i);

                        if (i<3) {
                            energyData += " ";
                        }
                    }

                    node.status({fill: "green", shape: "dot", text: energyData});

                    node.send(msg);
                } catch (e) {
                    node.status({fill: "red", shape: "dot", text: e.name});
                    node.send([null, e]);
                } finally {
                    await browser.close();
                }
            })();
        });
    }
    RED.nodes.registerType("energyGet", Mosenergy);
};