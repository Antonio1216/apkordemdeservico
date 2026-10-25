'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'../..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/build-photo-fixed-apk.yml'),'utf8');
const signing=fs.readFileSync(path.join(root,'scripts/sign-android-update.sh'),'utf8');

test('nenhum APK DEBUG com assinatura aleatória é publicado pelo workflow',()=>{
  assert.doesNotMatch(workflow,/path:\s*[^\n]*app-debug\.apk/);
  assert.match(workflow,/assembleRelease/);
  assert.match(workflow,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/scripts\/sign-android-update\.sh/);
  assert.match(workflow,/ACR_SIGNER_SHA256:\s*\$\{\{ vars\.ACR_SIGNER_SHA256 \}\}/);
  assert.match(workflow,/name: ACR-OS-Pro-v1\.7\.10-Atualizacao-Assinada/);
  assert.match(workflow,/path: dist\/ACR-OS-Pro-v1\.7\.10-Atualizacao-Assinada\.apk/);
});
test('sem keystore permanente e fingerprint, assinatura falha fechada',()=>{
  const env={...process.env,ANDROID_HOME:'/tmp/android-test-sdk',
    ACR_KEYSTORE_B64:'',ACR_KEYSTORE_PASSWORD:'',ACR_KEY_ALIAS:'',ACR_KEY_PASSWORD:'',ACR_SIGNER_SHA256:''};
  const r=spawnSync('bash',['scripts/sign-android-update.sh'],{cwd:root,env,encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr+r.stdout,/ACR_KEYSTORE_B64/);
  assert.match(signing,/Certificado de assinatura incompatível/);
  assert.match(signing,/SHA-256 digest/);
  assert.match(signing,/br\.com\.ospro\.ordens/);
  assert.match(signing,/apksigner/);
});
