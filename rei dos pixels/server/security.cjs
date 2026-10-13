'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
async function passwordHash(password,salt){return Buffer.from(await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024})).toString('hex');}
async function checkPassword(password,user){const salt=user?.password_salt||'unavailable-account-salt';const actual=await passwordHash(password,salt);return !!user?.password_hash&&crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(user.password_hash,'hex'));}
function error(status,message){return Object.assign(new Error(message),{status});}
function validateAccount(body,signup=false){if(typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email)||body.email.length>254)throw error(400,'Informe um e-mail válido.');if(typeof body.password!=='string'||body.password.length<10||body.password.length>128)throw error(400,'Use uma senha com 10 a 128 caracteres.');if(signup&&(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>16))throw error(400,'Use um nome de jogador com até 16 caracteres.');return {email:body.email.trim().toLowerCase(),password:body.password,name:signup?body.name.trim():undefined};}
module.exports={hash,token,passwordHash,checkPassword,error,validateAccount};
