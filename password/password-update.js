const puppeteer = require('puppeteer-core');
module.exports = function (RED) {

    function Mospass(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const configPassword = config.password;

        let use_cookies = config.use_cookies;
        if (use_cookies === undefined) {
            use_cookies = true;
        }

        function validateParams(url, password) {
            if (!url) {
                node.send([null, 'Не указан Логин в msg.url']);
                return false;
            }
            if (!password) {
                node.send([null, 'Не указан новый Пароль в msg.password или конфигурации ноды']);
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
            const url = msg.url;
            const password = msg.password || configPassword;
            if (!validateParams(url, password)) {
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

                    node.status({fill: "green", shape: "dot", text: 'Загрузка страницы'});
                    await page.goto(url, {
                        timeout: 60000,
                        waitUntil: 'networkidle0',
                    });

                    node.status({fill: "green", shape: "dot", text: 'Загрузка страницы...'});
                    await page.waitForTimeout(2000);

                    if (await page.$('#pswdFm') !== null) {
                        await page.waitForSelector('#pswd');
                        node.status({fill: "green", shape: "dot", text: 'Пароль 1'});
                        await page.click('#pswd');
                        await page.keyboard.type(password);
                        await page.waitForSelector('#repeatPswd');
                        node.status({fill: "green", shape: "dot", text: 'Пароль 2'});
                        await page.click('#repeatPswd');
                        await page.keyboard.type(password);
                        await page.waitForSelector('#pswdBtn');
                        node.status({fill: "green", shape: "dot", text: 'Восстановление пароля'});
                        await page.click('#pswdBtn');
                    }

                    await page.waitForTimeout(2000);

                    if (use_cookies) {

                        const client = await page.target().createCDPSession();
                        const all_browser_cookies = (await client.send('Network.getAllCookies')).cookies;
                        fs.writeFileSync("./cookies.json", JSON.stringify(all_browser_cookies, null, 2));
                    }

                    if (await page.waitForXPath('//*[contains(text(), "Доступ к учетной записи восстановлен")]') !== null) {
                        node.status({fill: "green", shape: "dot", text: 'Пароль восстановлен'});
                    }
                    else {
                        node.status({fill: "red", shape: "dot", text: 'Ошибка восстановления'});
                        throw new Error("Reset failed");
                    }

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
    RED.nodes.registerType("pwdUpdate", Mospass);
};