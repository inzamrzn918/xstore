#!/usr/bin/env node

/**
 * PrintShare - Automated Testing Script
 * Tests the desktop client API endpoints and functionality
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const DESKTOP_HOST = 'localhost';
const DESKTOP_PORT = 8888;
const TEST_FILES_DIR = path.join(__dirname, 'test-files');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test results
const results = {
    passed: 0,
    failed: 0,
    total: 0
};

// Helper functions
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
    results.total++;
    log(`\n[TEST ${results.total}] ${name}`, 'cyan');
}

function logPass(message) {
    results.passed++;
    log(`✅ PASS: ${message}`, 'green');
}

function logFail(message) {
    results.failed++;
    log(`❌ FAIL: ${message}`, 'red');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// Test: Check if desktop server is running
async function testServerRunning() {
    logTest('Desktop Server Running');

    return new Promise((resolve) => {
        const req = http.get(`http://${DESKTOP_HOST}:${DESKTOP_PORT}/`, (res) => {
            if (res.statusCode === 200 || res.statusCode === 404) {
                logPass(`Server is running on port ${DESKTOP_PORT}`);
                resolve(true);
            } else {
                logFail(`Unexpected status code: ${res.statusCode}`);
                resolve(false);
            }
        });

        req.on('error', (err) => {
            logFail(`Server not reachable: ${err.message}`);
            logInfo('Make sure the desktop client is running (npm start in desktop-client)');
            resolve(false);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            logFail('Connection timeout');
            resolve(false);
        });
    });
}

// Test: Upload a file
async function testFileUpload(filename) {
    logTest(`File Upload - ${filename}`);

    const filePath = path.join(TEST_FILES_DIR, filename);

    if (!fs.existsSync(filePath)) {
        logFail(`Test file not found: ${filePath}`);
        return false;
    }

    return new Promise((resolve) => {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('customerName', 'Test Customer');
        form.append('customerPhone', '1234567890');

        const options = {
            hostname: DESKTOP_HOST,
            port: DESKTOP_PORT,
            path: '/upload',
            method: 'POST',
            headers: form.getHeaders()
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    logPass(`File uploaded successfully: ${filename}`);
                    logInfo(`Response: ${data}`);
                    resolve(true);
                } else {
                    logFail(`Upload failed with status ${res.statusCode}`);
                    logInfo(`Response: ${data}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            logFail(`Upload error: ${err.message}`);
            resolve(false);
        });

        form.pipe(req);
    });
}

// Test: Upload multiple files
async function testMultipleFileUpload() {
    logTest('Multiple File Upload');

    const testFiles = [
        'test-document.txt',
        // Add more test files here
    ];

    let allPassed = true;

    for (const file of testFiles) {
        const result = await testFileUpload(file);
        if (!result) allPassed = false;
        await sleep(1000); // Wait between uploads
    }

    if (allPassed) {
        logPass('All files uploaded successfully');
    } else {
        logFail('Some files failed to upload');
    }

    return allPassed;
}

// Test: Large file upload
async function testLargeFileUpload() {
    logTest('Large File Upload (>1MB)');

    // Create a temporary large file
    const largeFilePath = path.join(TEST_FILES_DIR, 'large-test-file.txt');
    const fileSize = 2 * 1024 * 1024; // 2MB

    try {
        // Create large file with random data
        const buffer = Buffer.alloc(fileSize, 'A');
        fs.writeFileSync(largeFilePath, buffer);

        logInfo(`Created ${fileSize / 1024 / 1024}MB test file`);

        const result = await testFileUpload('large-test-file.txt');

        // Cleanup
        fs.unlinkSync(largeFilePath);

        return result;
    } catch (err) {
        logFail(`Error creating/uploading large file: ${err.message}`);
        return false;
    }
}

// Test: Invalid file type
async function testInvalidFileType() {
    logTest('Invalid File Type Rejection');

    // Create a .exe file (should be rejected)
    const invalidFilePath = path.join(TEST_FILES_DIR, 'test.exe');

    try {
        fs.writeFileSync(invalidFilePath, 'fake executable');

        const result = await testFileUpload('test.exe');

        // Cleanup
        fs.unlinkSync(invalidFilePath);

        if (!result) {
            logPass('Invalid file type correctly rejected');
            return true;
        } else {
            logFail('Invalid file type was accepted (security issue!)');
            return false;
        }
    } catch (err) {
        logFail(`Error testing invalid file: ${err.message}`);
        return false;
    }
}

// Test: Concurrent uploads
async function testConcurrentUploads() {
    logTest('Concurrent File Uploads');

    const uploads = [
        testFileUpload('test-document.txt'),
        testFileUpload('test-document.txt'),
        testFileUpload('test-document.txt')
    ];

    try {
        const results = await Promise.all(uploads);
        const allPassed = results.every(r => r === true);

        if (allPassed) {
            logPass('All concurrent uploads succeeded');
            return true;
        } else {
            logFail('Some concurrent uploads failed');
            return false;
        }
    } catch (err) {
        logFail(`Concurrent upload error: ${err.message}`);
        return false;
    }
}

// Helper: Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Print summary
function printSummary() {
    log('\n' + '='.repeat(50), 'cyan');
    log('TEST SUMMARY', 'cyan');
    log('='.repeat(50), 'cyan');
    log(`Total Tests: ${results.total}`);
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

    const passRate = ((results.passed / results.total) * 100).toFixed(2);
    log(`Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'red');

    log('='.repeat(50), 'cyan');

    if (results.failed === 0) {
        log('\n🎉 All tests passed!', 'green');
    } else {
        log('\n⚠️  Some tests failed. Please review the output above.', 'yellow');
    }
}

// Main test runner
async function runTests() {
    log('='.repeat(50), 'cyan');
    log('PrintShare - Automated Test Suite', 'cyan');
    log('='.repeat(50), 'cyan');
    log(`Testing desktop client at ${DESKTOP_HOST}:${DESKTOP_PORT}\n`);

    // Check if server is running
    const serverRunning = await testServerRunning();

    if (!serverRunning) {
        log('\n❌ Cannot proceed with tests - desktop server is not running', 'red');
        log('Please start the desktop client first: npm start in desktop-client directory', 'yellow');
        process.exit(1);
    }

    // Run tests
    await sleep(1000);
    await testFileUpload('test-document.txt');

    await sleep(1000);
    await testMultipleFileUpload();

    await sleep(1000);
    await testLargeFileUpload();

    await sleep(1000);
    await testInvalidFileType();

    await sleep(1000);
    await testConcurrentUploads();

    // Print summary
    printSummary();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
    runTests().catch(err => {
        log(`\n❌ Fatal error: ${err.message}`, 'red');
        console.error(err);
        process.exit(1);
    });
}

module.exports = { runTests };
