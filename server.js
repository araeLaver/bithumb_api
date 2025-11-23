const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const API_URL = 'https://api.bithumb.com';

// HMAC-SHA512 서명 생성 (Python 공식 코드와 동일)
function getSignature(endpoint, params, secretKey, nonce) {
    const paramString = new URLSearchParams(params).toString();

    // query_string = path + chr(0) + urllib.parse.urlencode(kwargs) + chr(0) + nonce
    const queryString = endpoint + String.fromCharCode(0) + paramString + String.fromCharCode(0) + nonce;

    // h = hmac.new(self.API_SECRET, query_string.encode('utf-8'), hashlib.sha512)
    const hmac = crypto.createHmac('sha512', secretKey);
    hmac.update(queryString, 'utf-8');

    // hex_output = h.hexdigest()
    const hexDigest = hmac.digest('hex');

    // utf8_hex_output = hex_output.encode('utf-8')
    // api_sign = base64.b64encode(utf8_hex_output)
    const signature = Buffer.from(hexDigest).toString('base64');

    return signature;
}

// 빗썸 API 호출
async function callBithumbAPI(endpoint, params, apiKey, secretKey) {
    try {
        const nonce = Date.now().toString();

        // endpoint는 파라미터에 포함하지 않음 (서명 생성 시에만 사용)
        const signature = getSignature(endpoint, params, secretKey, nonce);
        const paramString = new URLSearchParams(params).toString();

        console.log('=== API 호출 디버그 ===');
        console.log('Endpoint:', endpoint);
        console.log('Params:', params);
        console.log('ParamString:', paramString);
        console.log('Nonce:', nonce);
        console.log('Api-Key:', apiKey);
        console.log('Api-Sign:', signature);
        console.log('====================');

        const response = await axios({
            method: 'POST',
            url: API_URL + endpoint,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Api-Key': apiKey,
                'Api-Sign': signature,
                'Api-Nonce': nonce
            },
            data: paramString
        });

        return response.data;
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
    }
}

// 잔고 조회
app.post('/api/balance', async (req, res) => {
    try {
        const { apiKey, secretKey } = req.body;

        const params = {
            currency: 'ALL'
        };

        const result = await callBithumbAPI('/info/balance', params, apiKey, secretKey);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.response?.data?.message || error.message
        });
    }
});

// 현재 시세 조회
app.get('/api/ticker/:currency', async (req, res) => {
    try {
        const { currency } = req.params;
        const response = await axios.get(`${API_URL}/public/ticker/${currency}_KRW`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// XRP 시장가 매수
app.post('/api/buy', async (req, res) => {
    try {
        const { apiKey, secretKey, amount } = req.body;

        // 현재 시세 조회
        const tickerResponse = await axios.get(`${API_URL}/public/ticker/XRP_KRW`);

        if (tickerResponse.data.status !== '0000') {
            return res.status(400).json({
                status: 'error',
                message: '시세 조회 실패'
            });
        }

        const currentPrice = parseFloat(tickerResponse.data.data.closing_price);
        const units = (parseFloat(amount) / currentPrice).toFixed(4);

        // 시장가 매수 주문
        const params = {
            order_currency: 'XRP',
            payment_currency: 'KRW',
            units: units,
            type: 'bid'
        };

        const result = await callBithumbAPI('/trade/market_buy', params, apiKey, secretKey);

        res.json({
            ...result,
            currentPrice: currentPrice,
            units: units
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.response?.data?.message || error.message
        });
    }
});

// XRP 시장가 매도
app.post('/api/sell', async (req, res) => {
    try {
        const { apiKey, secretKey, units } = req.body;

        if (!units || parseFloat(units) <= 0) {
            return res.status(400).json({
                status: 'error',
                message: '매도 수량을 입력해주세요'
            });
        }

        // 현재 시세 조회
        const tickerResponse = await axios.get(`${API_URL}/public/ticker/XRP_KRW`);

        if (tickerResponse.data.status !== '0000') {
            return res.status(400).json({
                status: 'error',
                message: '시세 조회 실패'
            });
        }

        const currentPrice = parseFloat(tickerResponse.data.data.closing_price);

        // 시장가 매도 주문
        const params = {
            order_currency: 'XRP',
            payment_currency: 'KRW',
            units: parseFloat(units).toFixed(4),
            type: 'ask'
        };

        const result = await callBithumbAPI('/trade/market_sell', params, apiKey, secretKey);

        res.json({
            ...result,
            currentPrice: currentPrice,
            units: parseFloat(units).toFixed(4),
            estimatedAmount: (parseFloat(units) * currentPrice).toFixed(0)
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.response?.data?.message || error.message
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
