const puppeteer = require('puppeteer-core');
module.exports = function (RED) {

    function Mosenergy(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const configLogin = config.login;
        const configPassword = config.password;
        const configMosenergo_accnum = config.mosenergo_accnum;
        const configMosenergo_cntnum = config.mosenergo_cntnum;

        let use_cookies = config.use_cookies;
        if (use_cookies === undefined) {
            use_cookies = true;
        }

        function validateParams(login, password, mosenergo_accnum, mosenergo_cntnum, energy) {
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
            if (!energy) {
                node.send([null, 'Нет данных в msg.energy']);
                return false;
            }

            return true;
        }

        function getOptions(executablePath) {
            let options = {};
            options.executablePath = executablePath || '/usr/bin/chromium-browser';
            options.slowMo = 20;
            return options;
        }

        node.on('input', function (msg) {
            var url = 'https://www.mos.ru/services/pokazaniya-vodi-i-tepla/new/';
            const login = msg.login || configLogin;
            const password = msg.password || configPassword;
            const mosenergo_accnum = msg.mosenergo_accnum || configMosenergo_accnum;
            const mosenergo_cntnum = msg.mosenergo_cntnum || configMosenergo_cntnum;
            const energy = msg.energy;
            if (!validateParams(login, password, mosenergo_accnum, mosenergo_cntnum, energy)) {
                return;
            }
            (async () => {
               
                const fs = require("fs");

                let browser;
                try {
                    node.status({fill: "green", shape: "dot", text: 'Запуск браузера'});
                    const options = getOptions(msg.executablePath);
                    browser = await puppeteer.launch(options);
                    node.status({fill: "green", shape: "dot", text: 'Загрузка страницы'});


                    const page = await browser.newPage();
                    
                    if (use_cookies) {

                        if (fs.existsSync("./cookies.json")) {
                            node.status({fill: "green", shape: "dot", text: 'Установка куки'});
                            const cookiesString = fs.readFileSync("./cookies.json");
                            const cookies = JSON.parse(cookiesString);
                            await page.setCookie(...cookies);
                        }

                    }

                    node.status({fill: "green", shape: "dot", text: 'https://www.mos.ru/'});
                    await page.goto('https://www.mos.ru/', {
                        timeout: 60000,
                        waitUntil: 'networkidle0',
                    });

                    node.status({fill: "green", shape: "dot", text: 'Авторизация'});
                    await page.goto(url, {
                        timeout: 60000,
                        waitUntil: 'networkidle0',
                    });

                    node.status({fill: "green", shape: "dot", text: 'Авторизация...'});
                    await page.waitForTimeout(2000);

                    if (await page.$('#submit-meters') === null) {
                        await page.waitForSelector('#login');
                        node.status({fill: "green", shape: "dot", text: 'Логин'});
                        await page.click('#login');
                        await page.keyboard.type(login);
                        await page.waitForSelector('#password');
                        node.status({fill: "green", shape: "dot", text: 'Пароль'});
                        await page.click('#password');
                        await page.keyboard.type(password);
                        await page.waitForSelector('#bind');
                        node.status({fill: "green", shape: "dot", text: 'Вход'});
                        await page.click('#bind');
                    }


                    await page.waitForTimeout(2000);

                    if (await page.$('#content > div.form-wrapper > blockquote') === null) {
                        node.status({fill: "green", shape: "dot", text: 'Авторизация прошла'});
                    }
                    else {
                        node.status({fill: "green", shape: "dot", text: 'Авторизация 2...'});
                        await page.waitForSelector('#login');
                        node.status({fill: "green", shape: "dot", text: 'Логин'});
                        await page.click('#login');
                        await page.keyboard.type(login);
                        await page.waitForSelector('#password');
                        node.status({fill: "green", shape: "dot", text: 'Пароль'});
                        await page.click('#password');
                        await page.keyboard.type(password);
                        await page.waitForSelector('#bind');
                        node.status({fill: "green", shape: "dot", text: 'Вход'});
                        await page.click('#bind');
                    }

                    await page.waitForTimeout(2000);

                    if (use_cookies) {

                        const client = await page.target().createCDPSession();
                        const all_browser_cookies = (await client.send('Network.getAllCookies')).cookies;
                        fs.writeFileSync("./cookies.json", JSON.stringify(all_browser_cookies, null, 2));
                        const result = all_browser_cookies.some(i => i.name.includes('Ltpatoken2'));

                        if (result) {
                            node.status({fill: "green", shape: "dot", text: 'Авторизация успешна'});
                        }
                        else {
                            node.status({fill: "red", shape: "dot", text: 'Авторизация провалена'});
                            throw new Error("Authorization failed");
                        }

                    }

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
                    node.status({fill: "green", shape: "dot", text: 'Выгрузка данных'});


                    url = "https://www.mos.ru/pgu/common/ajax/index.php?";
                    url += "ajaxModule=Mosenergo&ajaxAction=qMpguDoTransPok&items%5Bid_kng%5D=";
                    url += msg.id_kng + "&items%5Bcode%5D=" + mosenergo_accnum;
                    for (var i = 1; i < 4; i++) {
                       url += "&items%5Bvl_pok_t" + i + "%5D=" + energy[i-1];
                    }
                    url += "&items%5Bs%D1%81hema%5D=" + msg.schem;

                    await page.goto(url);
                    content = await page.content();
                    content = content.match(/\{\".*\}\}/);
                    content = content[0];
                    content = JSON.parse(content);
                    msg.response = content;                 


                    node.status({fill: "green", shape: "dot", text: 'Загрузка данных'});
                    url = "https://www.mos.ru/pgu/common/ajax/index.php?";
                    url += "ajaxModule=Mosenergo&ajaxAction=qMpguGetLastPok&items%5Bcode%5D=";
                    url += mosenergo_accnum + "&items%5Bid_kng%5D=";
                    url += msg.id_kng + "&items%5Bs%D1%81hema%5D=" + msg.schem;

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
    RED.nodes.registerType("energySet", Mosenergy);
};