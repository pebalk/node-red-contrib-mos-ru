const puppeteer = require('puppeteer-core');
module.exports = function (RED) {

    function Mospass(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const configEmail = config.email;
        const configSurname = config.surname;

        let use_cookies = config.use_cookies;
        if (use_cookies === undefined) {
            use_cookies = true;
        }

        function validateParams(email, surname) {
            if (!email) {
                node.send([null, 'Не указан E-mail в msg.email или конфигурации ноды']);
                return false;
            }
            if (!surname) {
                node.send([null, 'Не указана Фамилия в msg.surname или конфигурации ноды']);
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
            var url = 'https://login.mos.ru/sps/recovery';
            const email = msg.email || configEmail;
            const surname = msg.surname || configSurname;
            if (!validateParams(email, surname)) {
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

                    if (await page.$('#startFm') !== null) {
                        await page.waitForSelector('#login');
                        node.status({fill: "green", shape: "dot", text: 'E-mail'});
                        await page.click('#login');
                        await page.keyboard.type(email);
                        await page.waitForSelector('#LastName');
                        node.status({fill: "green", shape: "dot", text: 'Фамилия'});
                        await page.click('#LastName');
                        await page.keyboard.type(surname);
                        await page.waitForSelector('#startBtn');
                        node.status({fill: "green", shape: "dot", text: 'Восстановление доступа'});
                        await page.click('#startBtn');
                    }


                    await page.waitForTimeout(2000);

                    if (use_cookies) {

                        const client = await page.target().createCDPSession();
                        const all_browser_cookies = (await client.send('Network.getAllCookies')).cookies;
                        fs.writeFileSync("./cookies.json", JSON.stringify(all_browser_cookies, null, 2));
                    }

                    if (await page.$('#cfmFm') !== null) {
                        node.status({fill: "green", shape: "dot", text: 'Код отправлен'});
                    }
                    else {
                        node.status({fill: "red", shape: "dot", text: 'Ошибка данных'});
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
    RED.nodes.registerType("pwdReset", Mospass);
};