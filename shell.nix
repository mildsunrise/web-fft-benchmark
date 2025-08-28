{ pkgs ? import <nixpkgs> {} }: with pkgs; mkShell {
	nativeBuildInputs = with buildPackages; [
		rustc lld
		binaryen
		nodejs_24
	];
}
