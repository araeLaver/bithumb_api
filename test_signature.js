const crypto = require('crypto');

// 테스트용 값들
const endpoint = '/info/balance';
const params = {
    currency: 'ALL',
    endpoint: '/info/balance'
};
const nonce = '1234567890';
const secretKey = 'test_secret_key';

console.log('=== 서명 생성 테스트 ===\n');

// 파라미터 문자열 생성
const paramString = new URLSearchParams(params).toString();
console.log('1. 파라미터 문자열:', paramString);

// 쿼리 문자열 생성
const queryString = endpoint + String.fromCharCode(0) + paramString + String.fromCharCode(0) + nonce;
console.log('2. 쿼리 문자열 (chr(0) 표시):',
    endpoint + '[CHR0]' + paramString + '[CHR0]' + nonce);

// HMAC-SHA512 생성
const hmac = crypto.createHmac('sha512', secretKey);
hmac.update(queryString, 'utf-8');
const hexDigest = hmac.digest('hex');
console.log('3. HMAC-SHA512 Hex Digest:', hexDigest.substring(0, 50) + '...');

// Base64 인코딩
const signature = Buffer.from(hexDigest, 'utf-8').toString('base64');
console.log('4. 최종 서명 (Base64):', signature.substring(0, 50) + '...');

console.log('\n=== 전체 서명 값 ===');
console.log(signature);
