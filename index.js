const chromeLauncher = require("chrome-launcher");
const chromium = require('chrome-aws-lambda');
const lighthouse = require('lighthouse');

async function runLighthouse(req) {
    const flags = {
        port: undefined,
        output: 'json',
        logLevel: 'warning'
    };

    const defaultFlags =  [
        '--headless',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--single-process'
    ];
    const url = req.url;
    const lhConfig = {extends: 'lighthouse:default'};

    const launcherOptions = {
        chromeFlags: defaultFlags
    };

    //Only set the chromePath if actually executing in a lambda
    if (process.env.LAMBDA_TASK_ROOT && process.env.AWS_EXECUTION_ENV) {
        launcherOptions['chromePath'] = await chromium.executablePath;
    }
    console.log('Generating report for', url)
    console.time('Lighthouse-' + url);
    const chrome = await chromeLauncher.launch({
            "chromeFlags":[
                "--headless",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--single-process"
            ],
            "chromePath":"/tmp/chromium"
        });
    const runnerResult = await lighthouse(url, {
			logLevel: 'warning',
			output: 'json',
			port: chrome.port
		});

    await chrome.kill();
    
    console.log('Report is done for', runnerResult.lhr.finalUrl);
    
    const rtn = {}

    for (const [key, value] of Object.entries(runnerResult.lhr.audits)) {
        delete value.id;
        delete value.title;
        delete value.description;

        if(key === 'full-page-screenshot' && value.details && value.details.nodes) {
            delete value.details.nodes;
        }

        rtn[key] = value;
    }

    rtn['category-scores'] = {};
    rtn['total-score'] = 0;

    for (const [key, value] of Object.entries(runnerResult.lhr.categories)) {
        rtn['category-scores'][key] = value.score;
        rtn['total-score'] += value.score;
    }

    rtn['total-score'] = rtn['total-score'] / Object.keys(runnerResult.lhr.categories).length;

    console.timeEnd('Lighthouse-' + url);
    return rtn;
}

module.exports = {
    runLighthouse: runLighthouse
};