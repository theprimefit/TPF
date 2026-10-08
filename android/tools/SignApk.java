import com.android.apksig.ApkSigner;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK (v2 scheme) with a key from a PKCS12 keystore using apksig. */
public class SignApk {
    public static void main(String[] args) throws Exception {
        if (args.length != 6) {
            System.err.println("usage: SignApk <keystore> <storepass> <alias> <minSdk> <in.apk> <out.apk>");
            System.exit(2);
        }
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(args[0])) {
            ks.load(in, args[1].toCharArray());
        }
        PrivateKey key = (PrivateKey) ks.getKey(args[2], args[1].toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(args[2]);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("CERT", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(args[4]))
                .setOutputApk(new File(args[5]))
                .setMinSdkVersion(Integer.parseInt(args[3]))
                .setV1SigningEnabled(false) // minSdk 24+ verifies v2 only
                .setV2SigningEnabled(true)
                .build()
                .sign();
    }
}
