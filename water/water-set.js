const puppeteer = require('puppeteer-core');
module.exports = function (RED) {

    function Moswater(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const configLogin = config.login;
        const configPassword = config.password;
        const configPaycode = config.paycode;
        const configKv = config.kv;

        let use_cookies = config.use_cookies;
        if (use_cookies === undefined) {
            use_cookies = true;
        }

        function validateParams(login, password, paycode, kv, water) {
            if (!login) {
                node.send([null, 'Не указан Логин в msg.login или конфигурации ноды']);
                return false;
            }
            if (!password) {
                node.send([null, 'Не указан Пароль в msg.password или конфигурации ноды']);
                return false;
            }
            if (!paycode) {
                node.send([null, 'Не указан Код Плательщика в msg.paycode или конфигурации ноды']);
                return false;
            }
            if (!kv) {
                node.send([null, 'Не указан Номер Квартиры в msg.kv или конфигурации ноды']);
                return false;
            }
            if (!water) {
                node.send([null, 'Нет данных в msg.water']);
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
            const paycode = msg.paycode || configPaycode;
            const kv = msg.kv || configKv;
            const water = msg.water;
            if (!validateParams(login, password, paycode, kv, water)) {
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

                    url = "https://www.mos.ru/pgu/common/ajax/index.php?ajaxModule=Guis&ajaxAction=getCountersInfo&items%5Bpaycode%5D=";
                    url += paycode + "&items%5Bflat%5D=" + kv;

                    await page.goto(url);
                    var content = await page.content();
                    content = content.match(/\{\"paycod.*\}/);
                    content = content[0];
                    content = JSON.parse(content);
                    msg.content = content;
                    node.status({fill: "green", shape: "dot", text: 'Выгрузка данных'});

                    var d = new Date(),
                    month = '' + (d.getMonth() + 1),
                    year = d.getFullYear(),
                    day = '' + new Date(year, month, 0).getDate(),
                    dt;

                    if (month.length < 2) 
                        month = '0' + month;
                    if (day.length < 2) 
                        day = '0' + day;
                    dt = [year, month, day].join('-');

                    url = "https://www.mos.ru/pgu/common/ajax/index.php?ajaxModule=Guis&ajaxAction=addCounterInfo&items%5Bpaycode%5D=";
                    url += paycode + "&items%5Bflat%5D=" + kv;

                    for (var i = 0; i < content.counter.length; i++) {
                        url += "&items%5Bindications%5D%5B" + [i];
                        url += "%5D%5BcounterNum%5D=" + content.counter[i].counterId;
                        url += "&items%5Bindications%5D%5B" + [i];
                        url += "%5D%5BcounterVal%5D=" + water[i];
                        url += "&items%5Bindications%5D%5B" + [i];
                        url += "%5D%5Bnum%5D=" + content.counter[i].num;
                        url += "&items%5Bindications%5D%5B" + [i];
                        url += "%5D%5Bperiod%5D=" + dt;
                    }

                    await page.goto(url);
                    content = await page.content();
                    content = content.match(/\{\"cod.*\}/);
                    content = content[0];
                    content = JSON.parse(content);
                    msg.response = content;                 

                    node.status({fill: "green", shape: "dot", text: 'Загрузка данных'});

                    url = "https://www.mos.ru/pgu/common/ajax/index.php?ajaxModule=Guis&ajaxAction=getCountersInfo&items%5Bpaycode%5D=";
                    url += paycode + "&items%5Bflat%5D=" + kv;

                    await page.goto(url);
                    var content = await page.content();
                    content = content.match(/\{\"paycod.*\}/);
                    content = content[0];
                    content = JSON.parse(content);
                    msg.content = content;

                    var waterData = "";

                    for (var i = 0; i < content.counter.length; i++) {
                        waterData += content.counter[i].indications[0].indication;

                        if (i < content.counter.length-1) {
                            waterData += " ";
                        }
                    }

                    node.status({fill: "green", shape: "dot", text: waterData});

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
    RED.nodes.registerType("waterSet", Moswater);
};