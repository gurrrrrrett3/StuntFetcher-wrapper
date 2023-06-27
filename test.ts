import StuntFetcher from "./index";

async function main() {
  const sf = new StuntFetcher();

  sf.once("open", () => {
    sf.getServers(true).then((servers) => {
      console.log(servers);
    });
  });

  setTimeout(() => {}, 10000);
};

main();
