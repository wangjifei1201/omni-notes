"""
WeChat MiniProgram data decryption utility.

用于解密微信小程序返回的加密数据（如手机号）
"""

import json
import base64
from typing import Dict, Any
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


class WeChatDecryptError(Exception):
    """微信数据解密错误"""

    pass


class WeChatDecrypt:
    """微信小程序数据解密工具"""

    def __init__(self, appid: str, session_key: str):
        """
        初始化解密工具

        Args:
            appid: 微信小程序 AppID
            session_key: 微信会话密钥（从 code2session 接口获取）
        """
        self.appid = appid
        self.session_key = session_key

    def decrypt(self, encrypted_data: str, iv: str) -> Dict[str, Any]:
        """
        解密微信加密数据

        Args:
            encrypted_data: 加密数据（Base64编码）
            iv: 解密算法初始向量（Base64编码）

        Returns:
            解密后的数据字典

        Raises:
            WeChatDecryptError: 解密失败
        """
        try:
            # Base64 解码
            session_key_bytes = base64.b64decode(self.session_key)
            encrypted_data_bytes = base64.b64decode(encrypted_data)
            iv_bytes = base64.b64decode(iv)

            # AES-CBC 解密
            cipher = Cipher(
                algorithms.AES(session_key_bytes),
                modes.CBC(iv_bytes),
                backend=default_backend(),
            )
            decryptor = cipher.decryptor()
            decrypted = decryptor.update(encrypted_data_bytes) + decryptor.finalize()

            # 去除补位（PKCS7）
            pad = decrypted[-1]
            decrypted = decrypted[:-pad]

            # 解析 JSON
            result = json.loads(decrypted.decode("utf-8"))

            # 验证 appId
            if result.get("watermark", {}).get("appid") != self.appid:
                raise WeChatDecryptError("Invalid appId in decrypted data")

            return result

        except Exception as e:
            raise WeChatDecryptError(f"Failed to decrypt WeChat data: {str(e)}")

    def decrypt_phone_number(self, encrypted_data: str, iv: str) -> Dict[str, str]:
        """
        解密微信手机号数据

        Args:
            encrypted_data: 加密的手机号数据
            iv: 解密算法初始向量

        Returns:
            包含手机号信息的字典:
            {
                'phone': '完整手机号（带国际区号）',
                'pure_phone': '纯手机号',
                'country_code': '国家码'
            }
        """
        data = self.decrypt(encrypted_data, iv)

        return {
            "phone": data.get("phoneNumber"),
            "pure_phone": data.get("purePhoneNumber"),
            "country_code": data.get("countryCode"),
        }
