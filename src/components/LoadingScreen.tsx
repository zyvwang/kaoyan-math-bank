import styles from "./SetupScreen.module.css";

export function LoadingScreen() {
  return (
    <main className={styles.loadingScreen}>
      <div className={styles.loadingMark}>考研数学一题库</div>
    </main>
  );
}
